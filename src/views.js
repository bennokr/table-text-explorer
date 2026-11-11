import { synchronizeViewColors } from './view-colors.js';
import { $ } from './dom.js';
import { defaultViews, isPointView, isResultView, newView } from './view-config.js';
import { ViewLayout } from './view-layout.js';
import { ViewCard } from './view-card.js';

export class Views {
  cards = new Map();

  constructor(model, reportError, openProjectionSettings) {
    this.model = model;
    this.reportError = reportError;
    this.actions = { settings: openProjectionSettings, update: (view, patch) => this.save(view.id, patch),
      expand: view => this.expand(view),
      up: view => this.layout.cardDrag.up(view.id),
      move: view => this.layout.moveEarlier(view.id), duplicate: view => this.duplicate(view), remove: view => this.remove(view) };
    $('#add-chart').onclick = () => this.add();
    $('#clear-views').onclick = () => this.clear();
    this.layout = new ViewLayout(model);
    model.on('data', () => this.defaults());
    model.on('views', () => this.sync());
    model.on('schema', () => this.sync());
    model.on('open-result', () => this.openResult());
    model.on('analysis-card', () => this.revealAnalysis());
    model.on('results', () => this.sync());
  }

  revealAnalysis() {
    this.restore();
    this.sync();
    this.cards.get(this.model.analysisViewId)?.node.scrollIntoView({ block: 'nearest' });
  }

  openResult() {
    const result = this.model.results.get(this.model.openResultId);
    if (!result || !['projection', 'clustering'].includes(result.kind)) { return; }
    this.restore();
    const added = this.save(null, { type: result.kind === 'projection' ? 'map' : 'legend', resultId: result.id, title: '', color: '', x: '', y: '' });
    this.cards.get(added.id)?.node.scrollIntoView({ block: 'nearest' });
  }

  add() {
    this.restore();
    const view = newView(this.model);
    delete view.id;
    this.save(null, view);
    this.cards.get(this.model.views.at(-1).id).node.scrollIntoView({ block: 'nearest' });
  }

  defaults() {
    this.cards.forEach(card => card.destroy());
    this.cards.clear();
    this.layout.reset();
    this.model.views = defaultViews(this.model);
    this.model.viewSequence = this.model.views.length;
    $('#views').scrollTop = 0;
    delete $('#views').dataset.expanded;
    this.sync();
  }

  save(id, config) {
    const view = this.model.views.find(view => view.id === id);
    const added = view ?? this.insert({ ...config, id: this.model.nextViewId() });
    if (view) { Object.assign(view, config); }
    if (view && !isResultView(view.type)) { delete view.resultId; }
    this.model.emit('views');
    return added;
  }

  // A map goes first and its legend right after it, so the two colour keys sit side by side.
  insert(added) {
    const views = this.model.views;
    const map = views.findIndex(view => view.type === 'map');
    if (added.type === 'map') { views.unshift(added); }
    else if (added.type === 'legend' && map >= 0) { views.splice(map + 1, 0, added); }
    else { views.push(added); }
    return added;
  }

  // Starts from an empty canvas so a map and its legend get the space; new defaults return with the next import.
  clear() {
    this.restore();
    this.model.views = [];
    this.model.emit('views');
  }

  discardCard(id) {
    this.cards.get(id).destroy();
    this.cards.delete(id);
    this.layout.widths.delete(id);
    this.layout.heights.delete(id);
    this.layout.breaks.delete(id);
  }

  reconcileCards() {
    const configs = new Map(this.model.views.map(view => [view.id, view]));
    for (const [id, card] of this.cards) {
      // An ID can survive a configuration replacement; its old handlers cannot.
      if (card.config !== configs.get(id)) { this.discardCard(id); }
    }
    if (!configs.has($('#views').dataset.expanded)) { delete $('#views').dataset.expanded; }
  }

  sync() {
    this.reconcileCards();
    synchronizeViewColors(this.model);
    let pointIndex = 0;
    for (const view of this.model.views) {
      let card = this.cards.get(view.id);
      if (!card) {
        card = new ViewCard(this.model, view, this.actions, this.reportError);
        this.cards.set(view.id, card);
      } else { card.sync(); }
      if (isPointView(view.type)) { card.node.dataset.pointIndex = String(pointIndex++); }
      else { delete card.node.dataset.pointIndex; }
      card.node.hidden = Boolean($('#views').dataset.expanded) && view.id !== $('#views').dataset.expanded;

    }
    this.layout.sync(this.model.views.map(view => this.cards.get(view.id)));
  }

  expand(view) {
    const container = $('#views');
    if (container.dataset.expanded === view.id) { delete container.dataset.expanded; }
    else { container.dataset.expanded = view.id; }
    for (const card of this.cards.values()) {
      card.node.hidden = Boolean(container.dataset.expanded) && card.config.id !== container.dataset.expanded;
      const expanded = container.dataset.expanded === card.config.id;
      card.expand.textContent = expanded ? '•' : '⛶';
      card.expand.setAttribute('aria-pressed', String(expanded));
    }
    this.layout.schedule();
  }

  duplicate(view) {
    this.restore();
    this.insert({ ...view, id: this.model.nextViewId() });
    this.model.emit('views');
  }

  restore() {
    const expanded = this.model.views.find(view => view.id === $('#views').dataset.expanded);
    if (expanded) { this.expand(expanded); }
  }

  remove(view) {
    if ($('#views').dataset.expanded === view.id) { this.expand(view); }
    this.model.views = this.model.views.filter(item => item.id !== view.id);
    this.model.emit('views');
  }

}
