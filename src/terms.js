import { $, element } from './dom.js';
import { featureCandidates, featureFields, stopwordList } from './features.js';
import { comparisonSets, renderTerms } from './term-view.js';
import { complete, progress } from './status.js';

export class Terms {
  version = 0;
  sequence = 0;
  indexId = null;
  running = false;
  intent = null;

  constructor(model, projection) {
    this.model = model;
    this.projection = projection;
    this.workers = projection.workers;
    $('#show-terms').onclick = () => this.tab(true);
    $('#show-charts').onclick = () => this.tab(false);
    $('#terms-form').onsubmit = event => {
      event.preventDefault();
      this.invalidate('Waiting to build the all-record index…');
      this.intent = 'build';
      this.drain();
    };
    $('#terms-form').oninput = () => {
      this.custom = true;
      this.invalidate('Text settings changed. Build the index again.');
      this.signature = this.signatureKey();
    };
    for (const id of ['terms-scope', 'terms-ranking', 'terms-support']) {
      $(`#${id}`).oninput = () => this.describe();
    }
    model.on('data', () => { this.custom = false; this.fields(); });
    model.on('schema', () => this.fields());
    for (const event of ['selection', 'view']) { model.on(event, () => this.describe()); }
    this.workers.addEventListener('idle', () => this.drain());
    this.workers.addEventListener('reset', event => {
      if (this.running) { complete(event.detail, true); }
      this.invalidate('Build an n-gram index to inspect subsets.');
      this.projection.busy(false);
    });
    this.fields();
  }

  tab(terms) {
    $('#terms').hidden = !terms;
    $('#charts').hidden = terms;
    $('#add-chart').hidden = terms;
    $('#show-terms').setAttribute('aria-pressed', String(terms));
    $('#show-charts').setAttribute('aria-pressed', String(!terms));
    if (terms) { this.describe(); this.drain(); }
  }

  fields() {
    const config = { ...this.model.config, mode: 'text',
      features: this.model.config.mode === 'table' ? null : this.model.config.features };
    const selected = this.custom ? this.selectedFields() : featureFields({ fields: this.model.fields, config }).map(field => field.name);
    const fields = featureCandidates({ fields: this.model.fields, config }).filter(field => !field.annotation);
    $('#terms-fields').replaceChildren(...fields.map(field => element('label', {}, [element('input', {
      type: 'checkbox', name: 'term-field', value: field.name, ...(selected.includes(field.name) ? { checked: '' } : {}) }),
    document.createTextNode(field.name)])));
    if (!this.custom) {
      $('#terms-language').value = this.model.config.language;
      $('#terms-stopwords').value = this.model.config.stopwords;
    }
    const signature = this.signatureKey();
    if (signature !== this.signature) { this.invalidate('Choose text fields and build an index.'); }
    this.signature = signature;
    $('#terms-build').disabled = !this.model.rows.length;
  }

  selectedFields() {
    return [...$('#terms-fields').querySelectorAll('input:checked')].map(input => input.value);
  }

  signatureKey() {
    return JSON.stringify([this.model.revision, this.selectedFields(), this.stopwords(), $('#terms-sizes').value]);
  }

  stopwords() {
    return stopwordList({ language: $('#terms-language').value, stopwords: $('#terms-stopwords').value }, true);
  }

  invalidate(message) {
    this.version += 1;
    this.indexId = null;
    this.intent = null;
    this.last = null;
    $('#terms-results').replaceChildren();
    $('#terms-status').textContent = message;
    $('#terms-index-controls').disabled = false;
  }

  query() {
    const support = Number($('#terms-support').value);
    if (!Number.isInteger(support) || support < 1) { throw new Error('Minimum support must be a positive record count.'); }
    return { indexId: this.indexId, ...comparisonSets(this.model, $('#terms-scope').value),
      support, ranking: $('#terms-ranking').value };
  }

  describe() {
    if (!this.indexId || $('#terms').hidden) { return; }
    this.intent = 'describe';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.drain(), 180);
  }

  build() {
    const fields = this.selectedFields();
    if (!fields.length) { throw new Error('Choose at least one text field.'); }
    return { task: 'terms_build', indexId: `${this.model.revision}:${++this.sequence}`,
      sizes: $('#terms-sizes').value.split(':').map(Number), stopwords: this.stopwords(), rows: this.model.rows.length,
      columns: fields.map(name => ({ name, texts: this.model.rows.map(row => row[name] ?? '') })) };
  }

  next() {
    const intent = this.intent;
    this.intent = null;
    if (intent === 'build') { return { payload: this.build(), type: 'build' }; }
    const payload = { ...this.query(), task: 'terms_describe' };
    if (!payload.subset.length) {
      this.last = null;
      $('#terms-results').replaceChildren();
      $('#terms-status').textContent = 'Highlight records, or choose filtered rows as the subset.';
      complete('No highlighted records to describe.');
      return null;
    }
    const key = JSON.stringify(payload);
    if (key === this.last && typeof intent === 'string') { return null; }
    if (typeof intent === 'object') { return { payload: { ...payload, ...intent, task: 'terms_matches' }, type: 'matches', key }; }
    return { payload, type: 'describe', key };
  }

  async drain() {
    if (this.running || !this.intent || $('#terms').hidden) { return; }
    if (this.workers.pending || $('#scatter-panel').getAttribute('aria-busy') === 'true') {
      $('#terms-status').textContent = 'Waiting for the current analysis…';
      return;
    }
    try { const job = this.next(); if (job) { await this.execute(job); } }
    catch (error) { $('#terms-status').textContent = error.message; }
  }

  async execute(job) {
    const version = this.version;
    this.running = true;
    this.projection.busy(true);
    $('#terms-index-controls').disabled = true;
    try {
      const result = await this.workers.run('python', job.payload, update => {
        progress(update);
        $('#terms-status').textContent = typeof update === 'string' ? update : update.message;
      });
      if (version === this.version) { this.finish(job, result); }
    } catch (error) {
      if (version === this.version) { complete(error.message, true); throw error; }
    } finally {
      this.running = false;
      if (version === this.version) { this.projection.busy(false); }
      $('#terms-index-controls').disabled = false;
      if (this.intent) { setTimeout(() => this.drain(), 0); }
    }
  }

  finish(job, result) {
    if (job.type === 'build') {
      this.indexId = job.payload.indexId;
      this.last = null;
      $('#terms-status').textContent = `Indexed ${this.model.rows.length} records. Highlight a subset.`;
      complete('All-record n-gram index ready.');
      this.describe();
      return;
    }
    const key = JSON.stringify({ ...this.query(), task: 'terms_describe' });
    if (key !== job.key) { complete('Updating the subset description…'); this.describe(); return; }
    if (job.type === 'matches') {
      this.model.select(result.ids);
      complete(`Highlighted ${result.ids.length} exact n-gram matches.`);
      return;
    }
    this.last = key;
    renderTerms($('#terms-results'), result, this.model, (field, phrase) => {
      this.intent = { field, phrase };
      this.drain();
    });
    $('#terms-status').textContent = `${result.subset} subset / ${result.comparison} comparison records${result.comparison ? '' : ' · no comparison; subset scores only'}`;
    complete('N-gram description updated. Projection fits unchanged.');
  }
}
