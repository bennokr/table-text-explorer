import { mountNameLength, nameLength } from './cluster-name-controls.js';
import { $, options } from './dom.js';
import { clusterColumns, clusterGroups } from './results.js';
import { clusteringName, suggestName, uniqueAnalysisName } from './analysis-names.js';
import { showClustering } from './analysis-views.js';
import { initializeTree } from './cluster-tree.js';
import { nameClusters } from './cluster-names.js';
import { complete } from './status.js';
import { Events } from './events.js';

// Fixed, not user settings: neither changes what a clustering finds, only how long it takes.
const MINIBATCH_SIZE = 1024;
const MAX_ITERATIONS = 100;

function inputSummary(model, source) {
  if (!source) { return `${model.rows.length} records · ${model.config.mode} · current map settings`; }
  return `${source.rowIds.length} records · ${source.kind === 'projection' ? '2D coordinates' : 'saved feature space'}`;
}

export class Clustering {
  normalize = true;

  constructor(model, analysis) {
    this.model = model;
    this.analysis = analysis;
    this.nameLength = mountNameLength($('#cluster-naming'));
    $('#cluster').onclick = () => this.open();
    $('#cluster-source').onchange = () => this.sourceDefaults();
    $('#cluster-method').onchange = () => this.controls();
    $('#cluster-form').oninput = event => { if (event.target.id !== 'cluster-name') { this.name(); } };
    $('#cluster-form').onsubmit = event => {
      event.preventDefault();
      this.fit();
    };
    model.on(Events.NAME_CLUSTERS, () => this.nameGroups(model.namingResult));
    model.on(Events.DENSITY_SELECTION, () => this.selectDensity(model.densityRequest));
    model.on(Events.BUSY, () => this.busy());
    model.on(Events.DATA, () => this.busy());
    this.busy();
  }

  open() {
    for (const details of $('#cluster-form').querySelectorAll('details')) { details.open = false; }
    const saved = this.model.results.list().filter(result => result.kind !== 'clustering');
    const preferred = saved.find(result => result.id === this.analysis.cache?.result.representationId)
      ?? saved.find(result => result.kind === 'representation');
    options($('#cluster-source'), [['', 'Current map settings'],
      ...saved.map(result => [result.id, `${result.name} · ${result.kind === 'projection' ? '2D coordinates' : 'Saved inputs'}`])], preferred?.id ?? '');
    $('#cluster-name').value = '';
    $('#cluster-suggest-names').checked = true;
    this.nameLength.value = '4';
    this.sourceDefaults();
    this.controls();
    $('#cluster-error').textContent = '';
    $('#cluster-dialog').showModal();
  }

  sourceDefaults() {
    const source = this.model.results.get($('#cluster-source').value);
    $('#cluster-source-summary').textContent = inputSummary(this.model, source);
    const count = source?.rowIds.length ?? this.model.rows.length;
    $('#cluster-count').value = Math.min(8, count);
    $('#cluster-min-size').value = Math.min(15, count);
    $('#cluster-min-samples').value = Math.min(5, count);
    // Unit-length vectors suit text representations; 2D maps and table columns keep their scale.
    this.normalize = source?.kind !== 'projection' && (source?.config?.mode ?? this.model.config.mode) !== 'table';
    this.name();
  }

  controls() {
    const method = $('#cluster-method').value;
    $('#cluster-linkage-label').hidden = method !== 'agglomerative';
    $('#cluster-density').hidden = method !== 'hdbscan';
    $('#cluster-count-label').hidden = method === 'hdbscan';
    this.busy();
    this.name();
  }

  name() {
    suggestName($('#cluster-name'), clusteringName(this.model, $('#cluster-source').value, this.parameters()));
  }

  busy() {
    $('#cluster').disabled = this.model.rows.length < 2 || this.model.analysisBusy;
    $('#cluster-submit').disabled = this.model.analysisBusy;
    for (const control of $('#cluster-form').querySelectorAll('input,select')) {
      control.disabled = this.model.analysisBusy || Boolean(control.closest('[hidden]'));
    }
  }

  parameters() {
    return { method: $('#cluster-method').value, clusters: Number($('#cluster-count').value),
      batchSize: MINIBATCH_SIZE, iterations: MAX_ITERATIONS,
      linkage: $('#cluster-linkage').value, minClusterSize: Number($('#cluster-min-size').value),
      minSamples: Number($('#cluster-min-samples').value), normalize: this.normalize };
  }

  async source(id, name) {
    if (!id) { return this.analysis.representation(name, true); }
    const saved = this.model.results.get(id);
    if (saved.kind === 'projection') {
      return { rowIds: saved.rowIds, representationId: saved.id, inputMapId: saved.id,
        config: saved.config, features: saved.rowIds.map(row => [saved.x.values[row], saved.y.values[row]]) };
    }
    return { ...saved, representationId: saved.id };
  }

  async fit() {
    if (this.model.analysisBusy) { return; }
    const generation = this.analysis.generation;
    const revision = this.model.revision;
    const parameters = this.parameters();
    const naming = { enabled: $('#cluster-suggest-names').checked, maximum: nameLength(this.nameLength) };
    const sourceId = $('#cluster-source').value;
    const name = uniqueAnalysisName(this.model, $('#cluster-name').value.trim());
    this.analysis.busy(true);
    $('#cluster-dialog').close();
    $('#cluster-error').textContent = '';
    try {
      const source = await this.source(sourceId, name);
      const result = await this.analysis.workers.run('python',
        { ...parameters, task: 'cluster', features: source.features }, this.analysis.progress);
      if (generation !== this.analysis.generation || revision !== this.model.revision) { return; }
      await this.save(result, source, parameters, name, naming);
    } catch (error) {
      if (generation === this.analysis.generation) {
        $('#cluster-error').textContent = error.message;
        complete(error.message, true);
      }
    } finally {
      if (generation === this.analysis.generation) { this.analysis.busy(false); }
    }
  }

  async selectDensity({ result, selection }) {
    if (this.model.analysisBusy) { return; }
    const generation = this.analysis.generation;
    const revision = this.model.revision;
    this.analysis.busy(true);
    try {
      const output = await this.analysis.workers.run('python', { task: 'density_select', tree: result.tree,
        minimum: result.parameters.minClusterSize, selection }, this.analysis.progress);
      if (generation !== this.analysis.generation || revision !== this.model.revision) { return; }
      Object.assign(result, output, { selection });
      this.model.resultsChanged();
      complete(`${result.name} · ${result.cut.length} density groups · saved tree reused.`);
    } catch (error) {
      if (generation === this.analysis.generation) { complete(error.message, true); }
    } finally {
      if (generation === this.analysis.generation) { this.analysis.busy(false); }
    }
  }

  async nameGroups(result) {
    if (this.model.analysisBusy) { return; }
    const generation = this.analysis.generation;
    const revision = this.model.revision;
    this.analysis.busy(true);
    try {
      await nameClusters(this.model, this.analysis, result);
      if (generation !== this.analysis.generation || revision !== this.model.revision) { return; }
      delete result.namingError;
      this.model.resultsChanged();
      complete('Phrase names updated. Edited names preserved.');
    } catch (error) { if (generation === this.analysis.generation) { complete(error.message, true); } }
    finally { if (generation === this.analysis.generation) { this.analysis.busy(false); } }
  }

  async save(output, source, parameters, name, naming) {
    const generation = this.analysis.generation;
    const revision = this.model.revision;
    const data = { ...output, name, method: parameters.method,
      parameters, maxNamePhrases: naming.maximum, rowIds: source.rowIds, sourceId: source.representationId,
      featureSetId: source.featureSetId, inputMapId: source.inputMapId,
      config: structuredClone(source.config ?? this.model.config), groups: clusterGroups(output.labels) };
    initializeTree(data);
    try { if (naming.enabled) { await nameClusters(this.model, this.analysis, data); } }
    catch (error) { data.namingError = error.message; }
    if (generation !== this.analysis.generation || revision !== this.model.revision) { return; }
    const result = this.model.results.add('clustering', data);
    clusterColumns(this.model, result);
    this.model.emit(Events.SCHEMA);
    this.model.analysisViewId = showClustering(this.model, result).id;
    this.model.emit(Events.ANALYSIS_CARD);
    this.model.resultsChanged();
    complete(`${data.namingError ? 'Phrase naming unavailable; use Rename all to retry. ' : ''}${result.name} · ${new Set(result.labels.filter(id => id !== -1)).size} groups · ${output.labels.filter(id => id === -1).length} Other records. Open the legend to rename groups; downloads are in Exports.`);
  }
}
