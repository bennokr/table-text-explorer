import { phraseSettings } from './phrase-config.js';
import { descriptionQuery, withEmbeddings } from './term-request.js';
import { describeHeading, describeStatus } from './term-output.js';
import { complete, progress } from './status.js';
import { formatQuery } from './query-predicates.js';

// Runs the description panel's work one job at a time: building the phrase index, screening columns, and
// describing the records. It reads the settings from the model and reports through `view`; it touches no controls.
export class TermJobs {
  version = 0;
  indexId = null;
  running = false;
  intent = null;
  result = null;

  constructor(model, analysis, { compare, facets, view }) {
    this.model = model;
    this.analysis = analysis;
    this.workers = analysis.workers;
    this.compare = compare;
    this.facets = facets;
    this.view = view;
  }

  build() { return phraseSettings(this.model); }

  query(compare = this.compare.resolve(this.indexId)) {
    return { ...descriptionQuery(this.model, this.indexId, compare), facetKey: this.facets.key };
  }

  // What a finished description is worth keeping for: the request and the query path, because the cloud
  // leaves out phrases the path already states. A click that adds a phrase to the path changes neither the
  // subset nor the comparison, and must still redraw the cloud.
  keyFor(payload) {
    return JSON.stringify({ payload, path: this.model.ast ? formatQuery(this.model.ast) : '' });
  }

  invalidate(message) {
    this.version += 1;
    this.indexId = null;
    this.analysis.textIndexes.activeId = null;
    this.intent = null;
    this.last = null;
    this.result = null;
    this.view.clear();
    this.view.message(message);
    this.view.indexState(false);
  }

  adopt() {
    const entry = this.analysis.textIndexes.get(this.build());
    if (!entry || this.indexId === entry.indexId) { return; }
    this.indexId = entry.indexId;
    this.analysis.textIndexes.activeId = entry.indexId;
    this.view.indexState(true);
    this.view.message('All-record text index ready.');
    this.describe();
  }

  // Asks for the descriptions to be brought up to date; bursts of changes become one run.
  describe() {
    if (this.view.hidden() || !this.model.rows.length) { return; }
    this.view.refresh();
    const phrases = this.model.termSettings.content !== 'facets' && this.build().fields.length;
    this.intent = phrases && !this.indexId ? 'build' : 'describe';
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.drain(), 180);
  }

  rerender() { if (this.result) { this.render(this.result); } }

  render(result, compare = null) {
    this.result = result;
    this.view.render(result, compare);
  }

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
      this.view.clear();
      this.view.message('Highlight records, or choose filtered rows as the subset.');
      complete('No highlighted records to describe.');
      return null;
    }
    const key = this.keyFor(payload);
    if (key === this.last) { return null; }
    if (payload.content !== 'phrases') { payload.facets = this.facets.request(this.workers.epoch); }
    return { payload, type: 'describe', key, compare };
  }

  async drain() {
    if (this.running || !this.intent || this.view.hidden()) { return; }
    if (this.workers.pending || this.model.analysisBusy) {
      this.view.message('Waiting for the current analysis…');
      return;
    }
    try { const job = this.next(); if (job) { await this.execute(job); } }
    catch (error) { this.view.message(error.message); }
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
        this.view.message(typeof update === 'string' ? update : update.message);
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

  finishScreen(job, result) {
    this.compare.accept(job.key, result);
    if (this.compare.mode(this.indexId) !== 'highlight') { this.last = null; }
    complete('Columns screened against the text.');
    this.describe();
  }

  finishBuild(result) {
    this.indexId = result.indexId;
    this.analysis.textIndexes.activeId = result.indexId;
    this.view.indexState(true);
    this.last = null;
    this.view.message(`Indexed ${this.model.rows.length} records.`);
    complete('All-record n-gram index ready.');
    this.describe();
  }

  finish(job, result) {
    if (job.type === 'screen') { this.finishScreen(job, result); return; }
    if (job.type === 'build') { this.finishBuild(result); return; }
    const key = this.keyFor({ ...this.query(job.compare), task: 'descriptions_describe' });
    if (key !== job.key) { complete('Updating the subset description…'); this.describe(); return; }
    this.last = key;
    this.render(result, job.compare);
    this.view.heading(describeHeading(this.query(job.compare), job.compare));
    this.view.message(describeStatus(result, job.compare, this.model));
    complete('Subset description updated. Similarity maps unchanged.');
    if (this.compare.pending(this.indexId)) { this.describe(); }
  }
}
