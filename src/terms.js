import { CompareBy } from './compare-by.js';
import { renderResult, showMessage } from './term-output.js';
import { FacetIndex } from './facet-index.js';
import { bindTermSettings, refreshDescriptionControls, termIndexState } from './term-settings.js';
import { bindTermControls } from './term-controls.js';
import { $ } from './dom.js';
import { clearTerms } from './term-view.js';
import { refreshEmbeddingChoices } from './term-request.js';
import { complete } from './status.js';
import { bindTreeControls } from './cluster-descriptions.js';
import { setTermSettings, treeChoice } from './term-settings-model.js';
import { TermJobs } from './term-jobs.js';
import { Events } from './events.js';

// Connects the description panel to the model: what happens when the table, the selection or a setting changes.
// The work itself is in TermJobs; this class only listens, and shows.
export class Terms {
  views = new Map();

  constructor(model, analysis) {
    this.model = model;
    this.analysis = analysis;
    this.facets = new FacetIndex(model);
    this.compare = new CompareBy(model, () => this.jobs.describe());
    this.jobs = new TermJobs(model, analysis, { compare: this.compare, facets: this.facets, view: this.panel() });
    this.lastSelection = model.selected;
    this.display = model.termSettings.display;
    bindTermSettings();
    bindTermControls(model);
    this.listen(model, analysis);
    bindTreeControls(model, () => this.jobs.describe());
    refreshEmbeddingChoices(model);
    this.fields();
  }

  // The page side of the jobs: where messages, clouds and the heading go.
  panel() {
    return {
      message: showMessage,
      clear: () => clearTerms($('#terms-results')),
      indexState: ready => termIndexState(ready, Boolean(this.model.rows.length)),
      render: (result, compare) => renderResult($('#terms-results'), result, compare, { model: this.model, views: this.views }),
      heading: text => { $('#description-kind').textContent = text; },
      hidden: () => $('#terms').hidden,
      refresh: () => {
        refreshDescriptionControls(this.model);
        refreshEmbeddingChoices(this.model);
        this.compare.fill(this.compare.current());
      },
    };
  }

  listen(model, analysis) {
    const { jobs } = this;
    model.on(Events.PHRASE_SETTINGS, () => this.fields());
    model.on(Events.TEXT_INDEX, () => { if (!jobs.running) { jobs.adopt(); } });
    // Resume after the previous job's finally block has restored its controls.
    model.on(Events.BUSY, () => { if (!model.analysisBusy) { queueMicrotask(() => jobs.drain()); } });
    model.on(Events.TERM_SETTINGS, () => this.settingsChanged());
    model.on(Events.RESULTS, () => refreshEmbeddingChoices(model));
    model.on(Events.DATA, () => { this.lastSelection = model.selected; this.fields(); });
    for (const type of [Events.SCHEMA, Events.CONFIG]) { model.on(type, () => this.fields()); }
    for (const type of [Events.ANNOTATION, Events.VIEW]) { model.on(type, () => jobs.describe()); }
    model.on(Events.SELECTION, () => this.selectionChanged());
    analysis.workers.addEventListener('idle', () => jobs.drain());
    analysis.workers.addEventListener('reset', event => {
      if (jobs.running) { complete(event.detail, true); }
      jobs.invalidate('Build an n-gram index to inspect subsets.');
      analysis.busy(false);
    });
  }

  settingsChanged() {
    const display = this.model.termSettings.display;
    if (display !== this.display) { this.display = display; this.jobs.rerender(); }
    else { this.jobs.describe(); }
  }

  // Brushing leaves a branch description and goes back to describing the highlight.
  selectionChanged() {
    const selected = this.model.selected;
    if (selected.size === this.lastSelection.size && [...selected].every(id => this.lastSelection.has(id))) { return; }
    this.lastSelection = selected;
    if (treeChoice(this.model.termSettings)) { setTermSettings(this.model, { compare: 'auto' }); }
    else { this.jobs.describe(); }
  }

  fields() {
    const signature = JSON.stringify([this.model.revision, this.jobs.build()]);
    if (signature !== this.signature) { this.jobs.invalidate('Preparing phrase descriptions…'); }
    this.signature = signature;
    this.jobs.adopt();
    this.jobs.describe();
  }
}
