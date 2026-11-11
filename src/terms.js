import { CompareBy } from './compare-by.js';
import { describeHeading, describeStatus, renderResult, showMessage } from './term-output.js';
import { FacetIndex } from './facet-index.js';
import { phraseSettings } from './phrase-config.js';
import { bindTermSettings, refreshDescriptionControls } from './term-settings.js';
import { termIndexState } from './term-settings.js';
import { $ } from './dom.js';
import { clearTerms } from './term-view.js';
import { descriptionQuery, refreshEmbeddingChoices, withEmbeddings } from './term-request.js';
import { complete, progress } from './status.js';
import { clusterScopes } from './cluster-descriptions.js';

export class Terms {
  version = 0;
  indexId = null;
  running = false;
  intent = null;
  views = new Map();

  constructor(model, analysis) {
    this.model = model;
    this.analysis = analysis;
    this.workers = analysis.workers;
    this.facets = new FacetIndex(model);
    this.compare = new CompareBy(model, () => this.describe());
    this.lastSelection = model.selected;
    bindTermSettings();
    model.on('phrase-settings', () => this.fields());
    model.on('text-index', () => { if (!this.running) { this.adopt(); } });
    // Resume after the previous job's finally block has restored its controls.
    model.on('busy', () => { if (!model.analysisBusy) { queueMicrotask(() => this.drain()); } });
    for (const id of ['terms-content', 'terms-scope', 'terms-ranking', 'terms-embedding', 'terms-support', 'terms-deduplicate', 'terms-tree-comparison']) {
      $(`#${id}`).oninput = () => this.describe();
    }
    $('#terms-display').oninput = () => { if (this.result) { this.render(this.result); } };
    model.on('results', () => refreshEmbeddingChoices(model));
    model.on('data', () => { this.lastSelection = model.selected; this.fields(); });
    model.on('schema', () => this.fields());
    model.on('annotation', () => this.describe());
    model.on('config', () => this.fields());
    model.on('view', () => this.describe());
    model.on('selection', () => this.selectionChanged());
    this.workers.addEventListener('idle', () => this.drain());
    this.workers.addEventListener('reset', event => {
      if (this.running) { complete(event.detail, true); }
      this.invalidate('Build an n-gram index to inspect subsets.');
      this.analysis.busy(false);
    });
    clusterScopes(model, () => this.describe());
    refreshEmbeddingChoices(model);
    this.fields();
  }

  selectionChanged() {
    const selected = this.model.selected;
    if (selected.size === this.lastSelection.size && [...selected].every(id => this.lastSelection.has(id))) { return; }
    this.lastSelection = selected;
    const scope = $('#terms-scope');
    if (this.model.results.get(scope.value)?.kind === 'clustering') {
      scope.value = 'selection';
      scope.dispatchEvent(new Event('input', { bubbles: true }));
    } else { this.describe(); }
  }

  fields() {
    const signature = JSON.stringify([this.model.revision, this.build()]);
    if (signature !== this.signature) { this.invalidate('Preparing phrase descriptions…'); }
    this.signature = signature;
    this.adopt();
    this.describe();
  }

  invalidate(message) {
    this.version += 1;
    this.indexId = null;
    this.analysis.textIndexes.activeId = null;
    this.intent = null;
    this.last = null;
    this.result = null;
    clearTerms($('#terms-results'));
    this.message(message);
    this.indexState(false);
  }

  indexState(ready) { termIndexState(ready, Boolean(this.model.rows.length)); }

  adopt() {
    const entry = this.analysis.textIndexes.get(this.build());
    if (!entry || this.indexId === entry.indexId) { return; }
    this.indexId = entry.indexId;
    this.analysis.textIndexes.activeId = entry.indexId;
    this.indexState(true);
    this.message('All-record text index ready.');
    this.describe();
  }

  message(text) { showMessage(text); }

  query(compare = this.compare.resolve(this.indexId)) {
    return { ...descriptionQuery(this.model, this.indexId, compare), facetKey: this.facets.key };
  }

  describe() {
    if ($('#terms').hidden || !this.model.rows.length) { return; }
    refreshDescriptionControls();
    this.compare.fill(this.compare.current());
    refreshEmbeddingChoices(this.model);
    const phrases = $('#terms-content').value !== 'facets' && this.build().fields.length;
    this.intent = phrases && !this.indexId ? 'build' : 'describe';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.drain(), 180);
  }

  build() { return phraseSettings(this.model); }

  next() {
    const intent = this.intent;
    this.intent = null;
    if (intent === 'build') { return this.buildJob(); }
    // A highlight is described first; its column screen follows without delaying the cloud.
    const first = this.compare.mode(this.indexId) === 'highlight' ? this.describeJob(null) : null;
    if (first) { return first; }
    const screen = this.compare.plan(this.indexId);
    if (screen) { return { type: 'screen', payload: screen.payload, key: screen.key }; }
    return this.describeJob(this.compare.resolve(this.indexId));
  }

  buildJob() {
    if (!this.build().fields.length) { throw new Error('Choose at least one text field.'); }
    return { payload: this.build(), type: 'build' };
  }

  describeJob(compare) {
    const payload = { ...this.query(compare), task: 'descriptions_describe' };
    if (!payload.subset.length) {
      this.last = null;
      clearTerms($('#terms-results'));
      this.message('Highlight records, or choose filtered rows as the subset.');
      complete('No highlighted records to describe.');
      return null;
    }
    const key = JSON.stringify(payload);
    if (key === this.last) { return null; }
    if (payload.content !== 'phrases') { payload.facets = this.facets.request(this.workers.epoch); }
    return { payload, type: 'describe', key, compare };
  }

  async drain() {
    if (this.running || !this.intent || $('#terms').hidden) { return; }
    if (this.workers.pending || this.model.analysisBusy) {
      this.message('Waiting for the current analysis…');
      return;
    }
    try { const job = this.next(); if (job) { await this.execute(job); } }
    catch (error) { this.message(error.message); }
  }

  run(job, report) {
    if (job.type === 'build') { return this.analysis.textIndexes.ensure(job.payload, report); }
    return this.workers.run('python', withEmbeddings(this.model, job.payload), report);
  }

  async execute(job) {
    const version = this.version;
    const revision = this.model.revision;
    const epoch = this.workers.epoch;
    this.running = true;
    this.analysis.busy(true);
    try {
      const report = update => {
        progress(update);
        this.message(typeof update === 'string' ? update : update.message);
      };
      const result = await this.run(job, report);
      this.facets.accept(job.payload.facets, epoch);
      if (version === this.version) { this.finish(job, result); }
    } catch (error) {
      if (version === this.version) { complete(error.message, true); throw error; }
    } finally {
      this.running = false;
      if (revision === this.model.revision && epoch === this.workers.epoch) { this.analysis.busy(false); }
      if (this.intent) { setTimeout(() => this.drain(), 0); }
    }
  }

  render(result, compare = null) {
    this.result = result;
    renderResult($('#terms-results'), result, compare, { model: this.model, views: this.views });
  }

  finishScreen(job, result) {
    this.compare.accept(job.key, result);
    if (this.compare.mode(this.indexId) !== 'highlight') { this.last = null; }
    complete('Columns screened against the text.');
    this.describe();
  }

  finish(job, result) {
    if (job.type === 'screen') { this.finishScreen(job, result); return; }
    if (job.type === 'build') {
      this.indexId = result.indexId;
      this.analysis.textIndexes.activeId = result.indexId;
      this.indexState(true);
      this.last = null;
      this.message(`Indexed ${this.model.rows.length} records.`);
      complete('All-record n-gram index ready.');
      this.describe();
      return;
    }
    const key = JSON.stringify({ ...this.query(job.compare), task: 'descriptions_describe' });
    if (key !== job.key) { complete('Updating the subset description…'); this.describe(); return; }
    this.last = key;
    this.render(result, job.compare);
    $('#description-kind').textContent = describeHeading(this.query(job.compare), job.compare);
    this.message(describeStatus(result, job.compare, this.model));
    complete('Subset description updated. Similarity maps unchanged.');
    if (this.compare.pending(this.indexId)) { this.describe(); }
  }
}
