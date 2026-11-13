import { element, glyph } from './dom.js';
import { Scatter } from './scatter.js';
import { ClusterLegend } from './cluster-legend.js';
import { AggregateView } from './charts.js';
import { ViewEditor } from './view-editor.js';
import { ViewPlaceholder } from './view-placeholder.js';
import { isPointView, isProjection, viewTitle, viewFieldsValid, viewSchemaKey } from './view-config.js';
import { CardColorKey } from './color-key.js';
import { Events } from './events.js';

export class ViewCard {
  constructor(model, config, actions, reportError) {
    this.model = model;
    this.config = config;
    this.reportError = reportError;
    this.editor = new ViewEditor(model, config, patch => actions.update(config, patch));
    const make = () => actions.settings(config);
    this.newMap = element('button', { type: 'button', text: 'New map here…', onclick: make });
    this.expand = glyph('⛶', 'Expand or restore chart', () => actions.expand(config));
    this.expand.setAttribute('aria-pressed', 'false');
    this.grip = glyph('⠿', 'Drag chart', () => {});
    this.grip.className = 'card-grip';
    this.more = glyph('⋯', 'Chart options', () => this.toggleMenu());
    this.header = element('header', {}, [this.grip, this.editor.type, this.editor.fields, this.expand, this.more]);
    this.menu = this.options(actions);
    this.container = element('div', { class: 'view-plot' });
    this.placeholder = new ViewPlaceholder(model, config, this.container, make);
    this.colorKey = new CardColorKey(model, config);
    this.node = element('section', { class: 'view-card', 'data-view-id': config.id }, [this.header, this.menu, this.container, this.colorKey.node]);
    this.cleanup = model.on(Events.BUSY, () => this.busy());
    this.sync();
  }

  options(actions) {
    const buttons = element('div', { class: 'card-actions' }, [
      glyph('⧉', 'Duplicate chart', () => actions.duplicate(this.config)),
      glyph('←', 'Move chart earlier', () => actions.move(this.config)),
      this.upButton(actions),
      glyph('×', 'Remove chart', () => actions.remove(this.config))]);
    const menu = element('div', { class: 'card-menu', hidden: '' }, [this.editor.nameLabel, this.editor.binsLabel, this.newMap, buttons]);
    this.more.setAttribute('aria-controls', `${this.config.id}-options`);
    menu.id = `${this.config.id}-options`;
    this.more.setAttribute('aria-expanded', 'false');
    return menu;
  }

  upButton(actions) {
    const button = glyph('↑', 'Move to row above', () => actions.up(this.config));
    button.className = 'move-up';
    return button;
  }

  toggleMenu() {
    this.menu.hidden = !this.menu.hidden;
    this.more.setAttribute('aria-expanded', String(!this.menu.hidden));
  }

  sync() {
    const config = this.config;
    this.editor.sync();
    this.node.dataset.point = String(isPointView(config.type));
    this.node.setAttribute('aria-label', viewTitle(config, this.model));
    this.newMap.hidden = !isProjection(config.type);
    this.renderIfChanged();
    this.colorKey.sync();
    const description = this.description();
    this.editor.type.title = `${viewTitle(config, this.model)} · ${description}`;
    this.editor.type.setAttribute('aria-description', description);
    this.container.dataset.empty = this.renderer || isProjection(config.type) ? '' : description;
    this.busy();
  }

  description() {
    if (this.config.type === 'legend' && !this.model.resultFor(this.config)) { return 'Create a clustering, or choose one with L.'; }
    if (!viewFieldsValid(this.model, this.config)) { return 'Choose compatible columns in this view.'; }
    const text = this.renderer?.description() ?? 'Make a similarity map, or choose an existing one with M.';
    return text;
  }

  renderIfChanged() {
    const config = this.config;
    const shape = isProjection(config.type) ? ['projection'] : [config.type, config.x, config.y, viewSchemaKey(this.model, config), ...this.chartSettings()];
    const key = JSON.stringify(shape);
    if (key !== this.key || this.model.resultFor(config) !== this.result) {
      this.placeholder.node.remove();
      this.renderer?.destroy();
      this.renderer = this.render();
      this.key = key;
      this.result = this.model.resultFor(config);
    } else { this.renderer?.paint?.(); }
  }

  // What a bar chart or histogram draws beyond its columns: the stack colors and the number of bins.
  chartSettings() {
    return isPointView(this.config.type) ? [] : [this.config.color, this.config.bins];
  }

  render() {
    if (!viewFieldsValid(this.model, this.config)) { return null; }
    if (isProjection(this.config.type) && !this.model.resultFor(this.config)) { return null; }
    if (this.config.type === 'legend') { return new ClusterLegend(this.model, this.config, this.container); }
    if (isPointView(this.config.type)) {
      return new Scatter(this.model, this.config, this.container, this.reportError);
    }
    return new AggregateView(this.model, this.config, this.container, this.reportError);
  }

  busy() {
    this.newMap.disabled = this.model.analysisBusy;
    this.placeholder.sync(isProjection(this.config.type) && !this.renderer);
  }

  destroy() {
    this.cleanup();
    this.editor.destroy();
    this.placeholder.destroy();
    this.colorKey.destroy();
    this.renderer?.destroy();
    this.node.remove();
  }
}
