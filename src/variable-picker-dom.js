import { element, options } from './dom.js';
import { variableGroups } from './variable-options.js';

let sequence = 0;

export function pickerControls(picker) {
  const trigger = element('button', { type: 'button', class: 'vp-trigger', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' });
  const search = element('input', { type: 'search', placeholder: 'Search names and descriptions', 'aria-label': 'Search variables' });
  const type = element('select', { 'aria-label': 'Variable type' });
  const selectedOnly = element('button', { type: 'button', text: 'Selected only', 'aria-pressed': 'false' });
  const summary = element('small', { class: 'vp-summary', role: 'status', 'aria-live': 'polite' });
  const bulk = element('button', { type: 'button' });
  const results = element('div', { class: 'vp-results' });
  const done = element('button', { type: 'button', text: 'Done', onclick: () => picker.close(true) });
  const panel = element('div', { id: `variable-picker-${++sequence}`, class: 'vp-panel', popover: 'auto', role: 'dialog' },
    [search, element('div', { class: 'vp-tools' }, [type, selectedOnly, bulk]), summary, results, done]);
  trigger.setAttribute('aria-controls', panel.id);
  return { trigger, search, type, selectedOnly, summary, bulk, results, panel };
}

function optionDescription(variable) {
  const counts = [];
  if (Number.isFinite(variable.nonMissing)) { counts.push(`${variable.nonMissing.toLocaleString()} non-missing`); }
  if (Number.isFinite(variable.missing)) { counts.push(`${variable.missing.toLocaleString()} missing`); }
  return [variable.type, ...counts].filter(Boolean).join(' · ');
}

function variableRow(picker, variable) {
  const selected = picker.selected.includes(variable.id);
  const text = element('span', { class: 'vp-option-text' }, [element('strong', { text: variable.label }),
    element('span', { text: variable.description ?? '' }), element('small', { text: optionDescription(variable) })]);
  const control = picker.multiple ? element('input', { type: 'checkbox', value: variable.id,
    ...(selected ? { checked: '' } : {}) }) : element('button', { type: 'button', class: 'vp-option', 'aria-pressed': String(selected) }, [text]);
  control.dataset.focusKey = `variable:${variable.id}`;
  control.dataset.option = '';
  control.addEventListener(picker.multiple ? 'change' : 'click', event => {
    event.stopPropagation();
    picker.choose(variable.id);
  });
  if (!picker.multiple) { return control; }
  return element('label', { class: 'vp-option' }, [control, text]);
}

function group(picker, name, variables) {
  const legend = element('legend', { text: name });
  if (picker.multiple) {
    const selected = variables.every(variable => picker.selected.includes(variable.id));
    const button = element('button', { type: 'button', text: selected ? 'Clear group' : 'Select group',
      'aria-label': `${selected ? 'Clear' : 'Select'} group ${name}`, onclick: () => picker.chooseGroup(variables) });
    button.dataset.focusKey = `group:${name}`;
    legend.append(button);
  }
  return element('fieldset', { class: 'vp-group' }, [legend, ...variables.map(variable => variableRow(picker, variable))]);
}

export function renderPicker(picker, matches) {
  const { search, results, type, selectedOnly, summary, bulk } = picker.controls;
  const focus = document.activeElement;
  const restore = results.contains(focus);
  const key = focus?.dataset.focusKey;
  const scroll = results.scrollTop;
  const selected = new Set(picker.selected);
  summary.textContent = `${selected.size} selected · ${matches.length} of ${picker.variables.length} shown`;
  selectedOnly.hidden = !picker.multiple;
  selectedOnly.setAttribute('aria-pressed', String(picker.selectedOnly));
  bulk.hidden = !picker.multiple || !matches.length;
  bulk.textContent = matches.every(variable => selected.has(variable.id)) ? 'Clear shown' : 'Select shown';
  const kinds = [...new Set(picker.variables.map(variable => variable.type).filter(Boolean))].sort();
  options(type, [['', 'All types'], ...kinds.map(kind => [kind, kind])], type.value);
  results.replaceChildren(...variableGroups(matches).map(([name, variables]) => group(picker, name, variables)));
  if (!matches.length) { results.append(element('p', { text: 'No matching variables.' })); }
  if (restore) {
    const next = [...results.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === key);
    (next ?? search).focus({ preventScroll: true });
  }
  results.scrollTop = scroll;
}

function moveChoice(choices, current, key) {
  const offsets = { ArrowDown: 1, ArrowUp: -1, Home: -choices.length, End: choices.length };
  if (!Object.hasOwn(offsets, key)) { return false; }
  if (current < 0 && !['ArrowDown', 'ArrowUp'].includes(key)) { return false; }
  const origin = current < 0 && key === 'ArrowUp' ? choices.length : current;
  const index = Math.max(0, Math.min(choices.length - 1, origin + offsets[key]));
  choices[index]?.focus();
  return true;
}

export function pickerKey(picker, event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); picker.close(true); return; }
  const choices = [...picker.controls.results.querySelectorAll('[data-option]')];
  const current = choices.indexOf(document.activeElement);
  if (current < 0 && event.target !== picker.controls.search) { return; }
  if (moveChoice(choices, current, event.key)) { event.preventDefault(); }
  if (event.key === 'Enter') {
    event.preventDefault();
    choices[Math.max(0, current)]?.click();
  }
}
