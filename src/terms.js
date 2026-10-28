import { phrasePredicate } from './query-predicates.js';
import { FacetIndex } from './facet-index.js';
import { phraseSettings } from './phrase-config.js';
import { bindTermSettings, refreshDescriptionControls } from './term-settings.js';
import { termIndexState } from './term-settings.js';
import { $ } from './dom.js';
import { renderTerms, clearTerms } from './term-view.js';
import { descriptionQuery, refreshEmbeddingChoices, withEmbeddings } from './term-request.js';
import { complete, progress } from './status.js';
import { clusterScopes, renderGroups, groupDescriptionStatus } from './cluster-descriptions.js';

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

  message(text) {
    $('#terms-status').textContent = text;
    $('#terms-index-status').textContent = text;
    $('#terms-empty').textContent = text;
  }

  query() {
    return { ...descriptionQuery(this.model, this.indexId), facetKey: this.facets.key };
  }

  describe() {
    if ($('#terms').hidden || !this.model.rows.length) { return; }
    refreshDescriptionControls();
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
    if (intent === 'build') {
      if (!this.build().fields.length) { throw new Error('Choose at least one text field.'); }
      return { payload: this.build(), type: 'build' };
    }
    const payload = { ...this.query(), task: 'descriptions_describe' };
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
    return { payload, type: 'describe', key };
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
      const result = job.type === 'build'
        ? await this.analysis.textIndexes.ensure(job.payload, report)
        : await this.workers.run('python', withEmbeddings(this.model, job.payload), report);
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

  render(result) {
    this.result = result;
    const usePredicate = (field, phrase, predicate) => {
      this.model.querySuggestion = predicate ?? phrasePredicate(field, phrase);
      this.model.emit('description-query');
    };
    if (result.groups) { renderGroups($('#terms-results'), result.groups, this.model, usePredicate, this.views); }
    else { renderTerms($('#terms-results'), result, this.model, usePredicate, this.views); }
  }

  finish(job, result) {
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
    const key = JSON.stringify({ ...this.query(), task: 'descriptions_describe' });
    if (key !== job.key) { complete('Updating the subset description…'); this.describe(); return; }
    this.last = key;
    this.render(result);
    const phrasesOnly = this.query().content === 'phrases';
    $('#description-kind').textContent = ({ frequency: phrasesOnly ? 'Common phrases' : 'Common predicates', balanced: 'Balanced splits', semantic: 'Semantic splits' })[this.query().ranking]
      ?? (phrasesOnly ? 'Distinctive phrases' : 'Distinctive predicates');
    this.message(result.groups ? groupDescriptionStatus(result.groups) : `${result.subset} subset / ${result.comparison} comparison records${result.comparison ? '' : ' · no comparison; subset scores only'}`);
    complete('Subset description updated. Similarity maps unchanged.');
  }
}
