import { $ } from './dom.js';
import { parseQuery } from './query.js';
import { formatQuery, appendPredicate } from './query-predicates.js';
import { conjuncts } from './query-path.js';
import { QueryField } from './query-field.js';
import { PhraseQueries } from './phrase-queries.js';
import { status } from './status.js';
import { Events } from './events.js';

export function highlightQuery(model, input, context) {
  const parsed = parseQuery(input, model.fields, context);
  model.ast = parsed.ast;
  model.select(parsed.ast ? model.visible.filter(id => parsed.test(model.rows[id])) : []);
}

class QuerySearch {
  version = 0;
  appliedInput = '';
  pathInput = ''; // The query text our own clicks produced; a different text means the user edited it.
  highlighting = false;

  constructor(model, analysis) {
    this.model = model;
    this.analysis = analysis;
    this.lastSelection = model.selected;
    this.phrases = new PhraseQueries(model, analysis);
    this.field = new QueryField(model, { onedit: () => this.edited(), onsubmit: () => this.apply(),
      onremove: index => this.conditionRemoved(index) });
    $('#filter-selection').onclick = () => this.filter();
    $('#clear-selection').onclick = () => this.clearSelection();
    $('#clear-filters').onclick = () => this.clear();
    model.on(Events.DESCRIPTION_QUERY, () => this.addPredicate());
    model.on(Events.SELECTION, () => this.selectionChanged());
    model.on(Events.DATA, () => { this.lastSelection = model.selected; this.resetQuery(); });
    model.on(Events.BUSY, () => { if (!model.analysisBusy && this.queued) { queueMicrotask(() => this.apply()); } });
    analysis?.workers.addEventListener('idle', () => { if (this.queued) { this.apply(); } });
  }

  // Typing highlights live: the query is applied shortly after the last keystroke.
  edited() {
    this.version += 1;
    this.filterRequested = false;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.apply(), 180);
  }

  addPredicate() {
    const version = ++this.version;
    this.filterRequested = false;
    this.queued = false;
    clearTimeout(this.timer);
    this.timer = null;
    try {
      const { ast } = parseQuery(this.field.text, this.model.fields, { phrase: () => () => false });
      this.rememberPopulation(ast);
      this.field.text = formatQuery(appendPredicate(ast, this.model.querySuggestion));
      this.pathInput = this.field.text;
      this.field.focus();
      this.apply();
    } catch (error) { this.failed(error, version); }
  }

  // The records before a click are what the next cloud is compared with ("the previous step").
  rememberPopulation(ast) {
    const count = conjuncts(ast).length;
    if (this.field.text !== this.pathInput) { this.model.populations = new Map(); }
    const before = ast ? this.model.visible.filter(id => this.model.selected.has(id)) : this.model.visible;
    this.model.populations.set(count, before);
  }

  // Removing a condition widens the query; the records before it are no longer a "previous step".
  conditionRemoved(index) {
    for (const key of [...this.model.populations.keys()]) { if (key >= index) { this.model.populations.delete(key); } }
    this.pathInput = this.field.text;
    this.apply();
  }

  selectionChanged() {
    const selected = this.model.selected;
    const changed = selected.size !== this.lastSelection.size || [...selected].some(id => !this.lastSelection.has(id));
    this.lastSelection = selected;
    if (changed && !this.highlighting) { this.resetQuery(); }
  }

  defer(requests) {
    if (!requests.length) { return false; }
    if (this.model.analysisBusy || this.analysis?.workers.pending) {
      this.queued = true;
      status('Waiting to prepare exact phrase matches…');
      return true;
    }
    return false;
  }

  publish(input) {
    if (input !== this.pathInput) { this.model.populations = new Map(); }
    this.highlighting = true;
    try { highlightQuery(this.model, input, this.phrases.context()); }
    finally { this.highlighting = false; }
    this.appliedInput = input;
    $('#search').removeAttribute('aria-invalid');
    status(this.model.ast ? 'Query matches highlighted · use ⏷ to filter.' : 'Query highlight cleared.');
    if (this.filterRequested) {
      this.filterRequested = false;
      this.pinHighlight();
    }
  }

  failed(error, version) {
    if (version !== this.version) { return; }
    this.filterRequested = false;
    $('#search').setAttribute('aria-invalid', 'true');
    status(`${error.message} Keeping the last valid highlight.`, true);
  }

  release(busy, generation) {
    if (busy && generation === this.analysis.generation) {
      for (const selector of ['#task-progress', '#panel-progress']) { $(selector).hidden = true; }
      this.analysis.busy(false);
    }
  }

  async apply() {
    clearTimeout(this.timer);
    this.timer = null;
    const version = ++this.version;
    const generation = this.analysis?.generation;
    let busy = false;
    try {
      const input = this.field.text;
      const requests = this.phrases.requests(input);
      if (this.defer(requests)) { return false; }
      this.queued = false;
      if (requests.length) {
        if (!this.analysis) { throw new Error('Exact phrase queries require the local analysis worker.'); }
        busy = true;
        this.analysis.busy(true);
        await this.phrases.prepare(requests);
      }
      if (version !== this.version) { return false; }
      this.publish(input);
      return true;
    } catch (error) { this.failed(error, version); return false; }
    finally { this.release(busy, generation); }
  }

  pinHighlight() {
    this.model.pinned = new Set(this.model.visible.filter(id => this.model.selected.has(id)));
    this.resetQuery();
    this.model.select([]);
    this.model.refresh();
    status('Filter applied · query and highlight cleared.');
  }

  filter() {
    // Flush unprocessed edits; an applied query may have been replaced by a brush.
    if (this.timer || this.queued || this.field.text !== this.appliedInput) {
      this.filterRequested = true;
      return this.apply();
    }
    this.pinHighlight();
    return true;
  }

  resetQuery() {
    this.filterRequested = false;
    this.version += 1;
    this.queued = false;
    clearTimeout(this.timer);
    this.timer = null;
    this.field.text = '';
    this.appliedInput = '';
    this.pathInput = '';
    this.model.populations = new Map();
    $('#search').removeAttribute('aria-invalid');
    this.model.ast = null;
  }

  clearSelection() {
    this.resetQuery();
    this.model.select([]);
    status('Selection and query cleared.');
  }

  clear() {
    this.resetQuery();
    this.model.select([]);
    this.model.pinned = null;
    this.model.query = () => true;
    this.model.refresh();
    status('Filters cleared · existing similarity maps unchanged.');
  }
}

export function bindSearch(model, analysis) { return new QuerySearch(model, analysis); }
