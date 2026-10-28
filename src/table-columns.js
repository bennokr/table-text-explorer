import './variable-picker.js';
import { $ } from './dom.js';
import { variableOptions } from './variable-options.js';

export function tableColumns(model) {
  const picker = $('#table-columns');
  const sync = () => {
    const previous = new Set(picker.variables.map(variable => variable.id));
    const added = model.fields.filter(field => !previous.has(field.name)).map(field => field.name);
    picker.variables = variableOptions(model.fields, model.rows.length);
    picker.selected = model.tableColumns === null ? model.fields.map(field => field.name) : [...model.tableColumns, ...added];
    if (model.tableColumns !== null) { model.tableColumns = picker.selected; }
    picker.disabled = !model.fields.length;
  };
  picker.onchange = () => {
    model.tableColumns = picker.selected;
    model.emit('table-columns');
  };
  model.on('data', sync);
  model.on('schema', sync);
  model.on('annotation', sync);
  sync();
}
