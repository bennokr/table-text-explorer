import { phraseSettings } from './phrase-config.js';
import { payload, featureKey, isEmbeddingMode } from './features.js';
import { TextIndexes } from './text-index.js';
import { Workers } from './workers/client.js';

export class Analysis {
  workers = new Workers();
  generation = 0;
  featureSequence = 0;

  constructor(model, progress) {
    this.model = model;
    this.textIndexes = new TextIndexes(model, (data, report) => this.workers.run('python', data, report));
    this.workers.addEventListener('reset', () => this.textIndexes.clear());
    model.on('data', () => { this.cache = null; });
    this.progress = update => {
      if (model.fittingViewId) {
        const task = typeof update === 'string' ? { message: update } : update;
        model.fitProgress = { ...task, viewId: model.fittingViewId };
        model.emit('fit-progress');
      }
      progress(update);
    };
  }

  busy(value) {
    this.model.analysisBusy = value;
    this.model.emit('busy');
  }

  async prepare() {
    const key = featureKey(this.model);
    if (this.cache?.key === key) { return this.cache.result; }
    const data = payload(this.model, 'prepare');
    await this.lexicalInputs(data);
    const embedded = isEmbeddingMode(data.mode) ? await this.embed(data)
      : { rowIds: this.model.rows.map((_, id) => id), coverage: [], embeddings: null,
        sentenceModel: null, aggregation: null, embeddingDimensions: null };
    const prepared = await this.workers.run('python', data, this.progress);
    const result = { ...prepared, ...embedded, inputFields: data.fields,
      featureSetId: `${this.model.revision}:${++this.featureSequence}`,
      config: { ...structuredClone(this.model.config), phrases: phraseSettings(this.model) } };
    this.cache = { key, result };
    return result;
  }

  async embed(data) {
    const embedded = await this.workers.run(data.mode === 'words' ? 'words' : 'sentences', data, this.progress);
    if (embedded.rowIds.length < 2) { throw new Error('Fewer than two records have usable embeddings. Check text fields, model settings and weights.'); }
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
    this.model.emit('results');
    return { ...prepared, representationId: saved.id };
  }

  async project(method, name) {
    const prepared = await this.representation(name);
    const config = this.model.config;
    const result = await this.workers.run(method === 'umap' ? 'umap' : 'python', {
      method, mode: 'prepared', features: prepared.features,
      neighbors: config.neighbors, epochs: config.epochs }, this.progress);
    return { ...prepared, coordinates: result.coordinates };
  }

  cancel() { this.generation += 1; this.workers.cancel(); }
}
