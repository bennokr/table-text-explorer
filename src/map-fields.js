import { $, element } from './dom.js';
import { isEmbeddingMode } from './features.js';
import { groupName } from './group-vectors.js';
import { weightOf } from './word-vectors.js';

let draft = { weights: {}, fieldGroups: {} };
let fields = [];

export function resetFieldOptions(config) {
  draft = { weights: { ...config.weights }, fieldGroups: { ...config.fieldGroups } };
  $('#feature-weights').replaceChildren();
  $('#group-assignments').replaceChildren();
}

export function readFieldOptions() {
  for (const input of $('#feature-weights').querySelectorAll('[data-weight]')) { draft.weights[input.dataset.weight] = Number(input.value); }
  for (const input of $('#group-assignments').querySelectorAll('[data-group]')) { draft.fieldGroups[input.dataset.group] = input.value.trim(); }
  return { weights: { ...draft.weights }, fieldGroups: { ...draft.fieldGroups } };
}

export function refreshFieldSummary() {
  readFieldOptions();
  const changed = fields.filter(field => weightOf(draft.weights, field.name) !== 1).length;
  $('#weights-summary').textContent = changed ? `Field weights · ${changed} customized` : 'Field weights · Equal weights';
  const count = new Set(fields.map(field => groupName(field, draft.fieldGroups))).size;
  $('#groups-summary').textContent = `Variable groups · ${count} ${count === 1 ? 'group' : 'groups'}`;
}

export function renderFieldOptions(model, selected, mode) {
  readFieldOptions();
  fields = selected.map(name => model.fields.find(field => field.name === name));
  $('#weights-details').hidden = !isEmbeddingMode(mode);
  $('#feature-weights').replaceChildren(...fields.map(field => element('label', { title: field.name }, [
    document.createTextNode(field.label ?? field.name), element('input', { type: 'number', min: '0', max: '100', step: '0.1',
      value: weightOf(draft.weights, field.name), 'data-weight': field.name, 'aria-label': `Weight of ${field.name}`, oninput: refreshFieldSummary }),
  ])));
  for (const input of $('#feature-weights').querySelectorAll('input')) { input.disabled = !isEmbeddingMode(mode); }
  $('#group-assignments').replaceChildren(...fields.map(field => element('label', { title: field.name }, [
    document.createTextNode(field.label ?? field.name), element('input', { value: groupName(field, draft.fieldGroups),
      'data-group': field.name, 'aria-label': `Group for ${field.name}`, onchange: refreshFieldSummary }),
  ])));
  $('#weights-reset').onclick = () => {
    for (const field of fields) { draft.weights[field.name] = 1; }
    for (const input of $('#feature-weights').querySelectorAll('input')) { input.value = '1'; }
    refreshFieldSummary();
    $('#map-form').dispatchEvent(new Event('change'));
  };
  refreshFieldSummary();
}

export function combiningControls() {
  const sentences = $('#feature-mode').value === 'sentences';
  $('#description-options').hidden = !sentences;
  $('#group-combining').hidden = !sentences || $('#field-combine').value !== 'group-mean';
  $('#group-identity-value').value = `${$('#group-identity').value}%`;
}
