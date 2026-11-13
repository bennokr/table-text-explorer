import { $ } from './dom.js';
import { Events } from './events.js';
import { setTermSettings } from './term-settings-model.js';
import { sizeSettings, sizeValue } from './size-choices.js';

// Control id, the property that holds its value, and how to read it back into the settings.
const CONTROLS = {
  content: ['terms-content', 'value', value => value],
  support: ['terms-support', 'value', value => Number(value)],
  deduplicate: ['terms-deduplicate', 'checked', value => Boolean(value)],
  color: ['terms-color', 'value', value => value],
  contrast: ['terms-contrast', 'value', value => value],
  treeComparison: ['terms-tree-comparison', 'value', value => value],
  groupPage: ['terms-group-page', 'value', value => Number(value) || 0],
};

// Size is the one control that holds two settings (the ranking and, for semantic splits, its embeddings).
// Edits in a control go into the settings; settings changed elsewhere (a branch being described, a ranking that
// stops being available) are written back to the controls.
export function bindTermControls(model) {
  for (const [key, [id, property, read]] of Object.entries(CONTROLS)) {
    $(`#${id}`).addEventListener('input', event => setTermSettings(model, { [key]: read(event.target[property]) }));
  }
  $('#terms-ranking').addEventListener('input', event => setTermSettings(model, sizeSettings(event.target.value)));
  model.on(Events.TERM_SETTINGS, () => showTermSettingValues(model));
  showTermSettingValues(model);
}

export function showTermSettingValues(model) {
  const size = $('#terms-ranking');
  if ([...size.options].some(option => option.value === sizeValue(model.termSettings))) { size.value = sizeValue(model.termSettings); }
  for (const [key, [id, property]] of Object.entries(CONTROLS)) {
    const control = $(`#${id}`);
    const value = model.termSettings[key];
    // A select without the wanted option keeps its own value until its options are filled.
    if (control[property] !== value && String(control[property]) !== String(value)) { control[property] = value; }
  }
}
