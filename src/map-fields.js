import { $, element } from './dom.js';
import { isEmbeddingMode } from './features.js';

// Embedding inputs and survey answers both combine columns through weights; groups come from the codebook.
const usesColumnOptions = mode => isEmbeddingMode(mode) || mode === 'survey';
import { groupName } from './group-vectors.js';
import { weightOf } from './word-vectors.js';

let draft = { weights: {} };
let fields = [];

export function resetFieldOptions(config) {
  draft = { weights: { ...config.weights } };
  $('#feature-weights').replaceChildren();
}

export function readFieldOptions() {
  for (const input of $('#feature-weights').querySelectorAll('[data-weight]')) { draft.weights[input.dataset.weight] = Number(input.value); }
  return { weights: { ...draft.weights } };
}

function refreshFieldSummary() {
  readFieldOptions();
  const changed = fields.filter(field => weightOf(draft.weights, field.name) !== 1).length;
  $('#weights-summary').textContent = changed ? `Column weights · ${changed} customized` : 'Column weights · Equal weights';
}

// Rows under a heading per codebook group, in order of first appearance; no headings when nothing is grouped.
function weightRows(columns, row) {
  if (!columns.some(field => field.group)) { return columns.map(row); }
  const groups = new Map();
  for (const field of columns) {
    const name = groupName(field);
    groups.set(name, [...(groups.get(name) ?? []), field]);
  }
  return [...groups].flatMap(([name, members]) => [element('strong', { class: 'weight-group' }, [document.createTextNode(name)]), ...members.map(row)]);
}

export function renderFieldOptions(model, selected, mode) {
  readFieldOptions();
  fields = selected.map(name => model.fields.find(field => field.name === name));
  $('#weights-details').hidden = !usesColumnOptions(mode);
  const weightRow = field => element('label', { title: field.name }, [
    document.createTextNode(field.label ?? field.name), element('input', { type: 'number', min: '0', max: '100', step: '0.1',
      value: weightOf(draft.weights, field.name), 'data-weight': field.name, 'aria-label': `Weight of ${field.name}`, oninput: refreshFieldSummary }),
  ]);
  $('#feature-weights').replaceChildren(...weightRows(fields, weightRow));
  for (const input of $('#feature-weights').querySelectorAll('input')) { input.disabled = !usesColumnOptions(mode); }
  $('#weights-reset').onclick = () => {
    for (const field of fields) { draft.weights[field.name] = 1; }
    for (const input of $('#feature-weights').querySelectorAll('input')) { input.value = '1'; }
    refreshFieldSummary();
    $('#map-form').dispatchEvent(new Event('change'));
  };
  refreshFieldSummary();
}

export function combiningControls() {
  const mode = $('#feature-mode').value;
  const survey = mode === 'survey';
  $('#combine-row').hidden = survey;
  $('#description-options').hidden = mode !== 'sentences';
  $('#group-combining').hidden = mode !== 'sentences' || $('#field-combine').value !== 'group-mean';
  $('#group-identity-value').value = `${$('#group-identity').value}%`;
  $('#survey-text-weight-value').value = `${$('#survey-text-weight').value}%`;
}
