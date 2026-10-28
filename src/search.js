import { $ } from './dom.js';
import { parseQuery } from './query.js';
import { formatQuery, appendPredicate } from './query-predicates.js';
import { PhraseQueries } from './phrase-queries.js';
import { status } from './status.js';

export function highlightQuery(model, input, context) {
  const parsed = parseQuery(input, model.fields, context);
  model.ast = parsed.ast;
  model.select(parsed.ast ? model.visible.filter(id => parsed.test(model.rows[id])) : []);
}

class QuerySearch {
  version = 0;
  appliedInput = '';
  highlighting = false;

  constructor(model, analysis) {
    this.model = model;
    this.analysis = analysis;
    this.lastSelection = model.selected;
    this.phrases = new PhraseQueries(model, analysis);
    $('#search').oninput = () => {
      this.version += 1;
      this.filterRequested = false;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.apply(), 180);
    };
    $('#search').onkeydown = event => { if (event.key === 'Enter') { this.apply(); } };
    $('#filter-selection').onclick = () => this.filter();
    $('#clear-selection').onclick = () => this.clearSelection();
    $('#clear-filters').onclick = () => this.clear();
    model.on('description-query', () => this.addPredicate());
    model.on('selection', () => this.selectionChanged());
    model.on('data', () => { this.lastSelection = model.selected; this.resetQuery(); });
    model.on('busy', () => { if (!model.analysisBusy && this.queued) { queueMicrotask(() => this.apply()); } });
    analysis?.workers.addEventListener('idle', () => { if (this.queued) { this.apply(); } });
  }

  addPredicate() {
    const version = ++this.version;
    this.filterRequested = false;
    this.queued = false;
    clearTimeout(this.timer);
    this.timer = null;
    try {
      const { ast } = parseQuery($('#search').value, this.model.fields, { phrase: () => () => false });
      $('#search').value = formatQuery(appendPredicate(ast, this.model.querySuggestion));
      $('#search').focus();
      this.apply();
    } catch (error) { this.failed(error, version); }
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
      const input = $('#search').value;
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
    if (this.timer || this.queued || $('#search').value !== this.appliedInput) {
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
    $('#search').value = '';
    this.appliedInput = '';
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
