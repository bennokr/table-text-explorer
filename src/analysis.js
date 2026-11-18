import { phraseSettings } from './phrase-config.js';
import { payload, featureKey, featureFields, isEmbeddingMode } from './features.js';
import { TextIndexes } from './text-index.js';
import { Workers } from './workers/client.js';
import { Events } from './events.js';
import { surveyRequest, surveyTextFields, surveyTextModel } from './survey-input.js';

export class Analysis {
  workers = new Workers();
  generation = 0;
  featureSequence = 0;

  constructor(model, progress) {
    this.model = model;
    this.textIndexes = new TextIndexes(model, (data, report) => this.workers.run('python', data, report));
    this.workers.addEventListener('reset', () => this.textIndexes.clear());
    model.on(Events.DATA, () => { this.cache = null; });
    this.progress = update => {
      if (model.fittingViewId) {
        const task = typeof update === 'string' ? { message: update } : update;
        model.fitProgress = { ...task, viewId: model.fittingViewId };
        model.emit(Events.FIT_PROGRESS);
      }
      progress(update);
    };
  }

  busy(value) {
    this.model.analysisBusy = value;
    this.model.emit(Events.BUSY);
  }

  async prepare() {
    const key = featureKey(this.model);
    if (this.cache?.key === key) { return this.cache.result; }
    const result = this.model.config.mode === 'survey' ? await this.prepareSurvey() : await this.prepareFeatures();
    this.cache = { key, result };
    return result;
  }

  async prepareFeatures() {
    const data = payload(this.model, 'prepare');
    await this.lexicalInputs(data);
    const embedded = isEmbeddingMode(data.mode) ? await this.embed(data)
      : { rowIds: this.model.rows.map((_, id) => id), coverage: [], embeddings: null,
        sentenceModel: null, aggregation: null, embeddingDimensions: null };
    const prepared = await this.workers.run('python', data, this.progress);
    const result = { ...prepared, ...embedded, inputFields: data.fields,
      featureSetId: `${this.model.revision}:${++this.featureSequence}`,
      config: { ...structuredClone(this.model.config), phrases: phraseSettings(this.model) } };
    return result;
  }

  // Survey answers: the free text is embedded first, then the worker compares every pair of records.
  async prepareSurvey() {
    const model = this.model;
    const text = surveyTextFields(model).length ? payload(surveyTextModel(model), 'prepare') : null;
    const embedded = text ? this.importedEmbeddings(text) ?? await this.workers.run('sentences', text, this.progress)
      : { rowIds: [], features: new Float32Array(0), coverage: [], sentenceModel: null, aggregation: null, dimensions: null };
    const request = surveyRequest(model, embedded.rowIds);
    const prepared = await this.workers.run('python', { ...request, features: embedded.features }, this.progress);
    const fields = featureFields(model).map(field => ({ name: field.name, kind: field.kind, group: field.group }));
    return { ...prepared, rowIds: model.rows.map((_, id) => id), coverage: embedded.coverage, embeddings: null,
      sentenceModel: embedded.sentenceModel, aggregation: embedded.aggregation, embeddingDimensions: embedded.dimensions,
      inputFields: fields, featureSetId: `${model.revision}:${++this.featureSequence}`,
      config: { ...structuredClone(model.config), phrases: phraseSettings(model) } };
  }

  // Embeddings imported from a file stand in for encoding the text again.
  importedEmbeddings(data) {
    const imported = data.mode === 'sentences' ? this.model.importedEmbeddings.get(data.sentence.model) : null;
    if (!imported) { return null; }
    const label = `Imported · ${imported.name}`;
    return { features: imported.features, dimensions: imported.dimensions, rowIds: imported.rowIds, coverage: [],
      sentenceModel: { label, dimensions: imported.dimensions }, aggregation: 'imported' };
  }

  async embed(data) {
    const embedded = this.importedEmbeddings(data)
      ?? await this.workers.run(data.mode === 'words' ? 'words' : 'sentences', data, this.progress);
    if (embedded.rowIds.length < 2) { throw new Error('Fewer than two records have usable embeddings. Check text columns, model settings and weights.'); }
    data.features = embedded.features;
    data.dimensions = embedded.dimensions;
    data.rows = embedded.rowIds.map(() => ({}));
    return { embeddings: embedded.features, rowIds: embedded.rowIds, coverage: embedded.coverage,
      sentenceModel: embedded.sentenceModel ?? null, aggregation: embedded.aggregation ?? null,
      embeddingDimensions: embedded.dimensions };
  }

  async lexicalInputs(data) {
    if (!['text', 'words'].includes(data.mode)) { return; }
    const settings = phraseSettings(this.model);
    data.fields = settings.fields.map(name => ({ name, kind: 'text' }));
    const index = await this.textIndexes.ensure(settings, this.progress);
    data.indexId = index.indexId;
    if (data.mode === 'words') {
      data.documents = await this.workers.run('python', { task: 'terms_tokens', indexId: index.indexId }, this.progress);
    }
  }

  async representation(name, reuse = false) {
    const prepared = await this.prepare();
    if (reuse && this.model.results.get(prepared.representationId)) { return prepared; }
    const suffix = prepared.embeddings ? 'embeddings' : 'features';
    const data = { ...prepared };
    delete data.representationId;
    const saved = this.model.results.add('representation', { ...data,
      config: prepared.config, method: prepared.config.mode, mapName: name, name: `${name}-${suffix}` });
    prepared.representationId = saved.id;
    this.model.emit(Events.RESULTS);
    return { ...prepared, representationId: saved.id };
  }

  async project(method, name) {
    const prepared = await this.representation(name);
    const config = this.model.config;
    const result = await this.workers.run(method === 'umap' ? 'umap' : 'python', {
      method, mode: 'prepared', features: prepared.features,
      neighbors: config.neighbors, epochs: config.epochs, graph: prepared.neighbours }, this.progress);
    return { ...prepared, coordinates: result.coordinates };
  }

  cancel() { this.generation += 1; this.workers.cancel(); }
}
