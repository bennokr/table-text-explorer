import './variable-picker.js';
import { variableOptions } from './variable-options.js';
import { element, options } from './dom.js';
import { categorical } from './schema.js';
import { eligibleFields, isProjection, isResultView, isPointView, viewTypes, changeViewType } from './view-config.js';
import { Events } from './events.js';

function resultSelect(label, name, change) {
  const select = element('select', { 'aria-label': name, onchange: event => change(event.target.value) });
  return { select, label: element('label', { class: 'control' }, [element('abbr', { text: `${label}:`, title: name }), select]) };
}

function fieldPicker(label, name, change) {
  const select = element('variable-picker', { 'aria-label': name });
  select.addEventListener('change', event => change(event.detail.selected[0]));
  return { select, label: element('span', { class: 'control' }, [element('abbr', { text: `${label}:`, title: name }), select]) };
}

function pickerOptions(picker, fields, selected) {
  picker.variables = fields;
  picker.selected = [selected ?? ''];
}

export class ViewEditor {
  constructor(model, config, change) {
    this.model = model;
    this.config = config;
    this.type = element('select', { class: 'view-type', 'aria-label': 'Chart type',
      onchange: event => change(changeViewType(model, config, event.target.value)) });
    options(this.type, viewTypes, config.type);
    this.x = fieldPicker('X', 'X column', x => change({ x }));
    this.y = fieldPicker('Y', 'Y column', y => change({ y }));
    this.legend = resultSelect('L', 'Clustering', resultId => change({ resultId }));
    this.map = resultSelect('M', 'Similarity map', resultId => change({ resultId }));
    this.color = fieldPicker('C', 'Color by', color => change({ color }));
    this.fields = element('div', { class: 'controls' }, [this.map.label, this.legend.label, this.x.label, this.y.label, this.color.label]);
    this.name = element('input', { 'aria-label': 'View name', placeholder: 'Automatic name',
      onchange: event => change({ title: event.target.value.trim() }) });
    this.nameLabel = element('label', { class: 'view-name', text: 'Name' }, [this.name]);
    this.cleanup = model.on(Events.ANNOTATION, () => this.sync());
    this.sync();
  }

  sync() {
    const view = this.config;
    const key = JSON.stringify([view.type, view.x, view.y, view.color, view.title, view.resultId, view.legendId,
      this.model.results.list().filter(result => result.kind !== 'representation').map(result => [result.id, result.mapName, result.name]),
      this.model.fields.map(field => [field.name, field.kind, field.missing])]);
    if (key === this.key) { return; }
    this.key = key;
    this.type.value = view.type;
    const fields = variableOptions(eligibleFields(this.model.fields, view.type), this.model.rows.length);
    const axes = view.type === 'scatter' ? [{ id: '', label: '# Row' }, ...fields] : fields;
    pickerOptions(this.x.select, axes, view.x);
    pickerOptions(this.y.select, axes, view.y);
    const colors = variableOptions(this.model.fields.filter(categorical), this.model.rows.length);
    pickerOptions(this.color.select, [{ id: '', label: 'None' }, ...colors], view.color);
    const maps = this.model.results.list('projection').map(result => [result.id, result.mapName ?? result.name]);
    options(this.map.select, [['', 'Choose map…'], ...maps], view.resultId);
    const clusters = this.model.results.list('clustering').map(result => [result.id, result.name]);
    options(this.legend.select, [['', 'Choose clustering…'], ...clusters], view.resultId);
    this.legend.label.hidden = view.type !== 'legend';
    this.map.label.hidden = !isProjection(view.type);
    this.x.label.hidden = isResultView(view.type);
    this.y.label.hidden = !['scatter', 'heatmap'].includes(view.type);
    this.color.label.hidden = !isPointView(view.type);
    this.name.value = view.title || '';
    for (const item of [this.map, this.legend]) { item.select.title = item.select.selectedOptions[0]?.textContent || 'None'; }
    this.syncColor();
  }

  destroy() { this.cleanup(); }

  syncColor() {
    const linked = Boolean(this.config.legendId);
    this.color.select.disabled = linked;
    this.color.select.setAttribute('aria-description', linked ? 'Colors follow the adjacent cluster legend.' : 'Choose a color column.');
    const name = this.config.color || 'None';
    this.color.select.title = linked ? `${name} · follows adjacent legend` : name;
  }

}
