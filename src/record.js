import { $, display, element, options } from './dom.js';
import { Events } from './events.js';

export function recordViewer(model, reportError) {
  const render = () => {
    const row = model.rows[model.active];
    $('#record-body').replaceChildren(...(row ? model.fields.map(field =>
      element('div', { class: 'record-field' }, [element('dt', { text: field.name, title: field.label ?? '' }),
        element('dd', { text: display(row[field.name]) })])) : [
      element('p', { class: 'empty', text: 'Select a point or record to inspect every field.' })]));
    const position = model.visible.indexOf(model.active);
    $('#record-position').textContent = row ? `Row ${model.active + 1} · ${position + 1} / ${model.visible.length}` : 'No record';
    const entries = model.annotations.size ? [...model.annotations].map(name => [name, name]) : [['', 'Annotation…']];
    options($('#annotation-column'), entries,
      $('#annotation-column').value);
    $('#annotation-column').disabled = !model.annotations.size;
    $('#annotation-value').disabled = !model.annotations.size;
    $('#assign').disabled = !model.annotations.size || model.active === null;
    $('#previous').disabled = position <= 0;
    $('#next').disabled = position < 0 || position >= model.visible.length - 1;
  };
  for (const type of [Events.DATA, Events.SCHEMA, Events.VIEW, Events.SELECTION, Events.ANNOTATION]) { model.on(type, render); }
  model.on(Events.DATA, () => { $('#record-body').scrollTop = 0; $('#annotation-value').value = ''; });
  const navigate = delta => {
    const index = model.visible.indexOf(model.active) + delta;
    if (index >= 0 && index < model.visible.length) { model.select([model.visible[index]]); }
  };
  $('#previous').onclick = () => navigate(-1);
  $('#next').onclick = () => navigate(1);
  $('#new-annotation').onclick = () => {
    const name = prompt('New annotation column name', 'annotation');
    if (name === null) { return; }
    try { model.addAnnotation(name.trim()); } catch (error) { reportError(error); }
  };
  $('#assign').onclick = () => {
    const ids = model.selected.size ? [...model.selected] : [model.active];
    model.annotate($('#annotation-column').value, ids, $('#annotation-value').value.trim());
  };
  render();
}
