import { $ } from './dom.js';
import { Events } from './events.js';
import { setTermSettings } from './term-settings-model.js';

// Control id, the property that holds its value, and how to read it back into the settings.
const CONTROLS = {
  content: ['terms-content', 'value', value => value],
  ranking: ['terms-ranking', 'value', value => value],
  embedding: ['terms-embedding', 'value', value => value],
  support: ['terms-support', 'value', value => Number(value)],
  deduplicate: ['terms-deduplicate', 'checked', value => Boolean(value)],
  display: ['terms-display', 'value', value => value],
  compare: ['terms-compare', 'value', value => value],
  treeComparison: ['terms-tree-comparison', 'value', value => value],
  groupPage: ['terms-group-page', 'value', value => Number(value) || 0],
};

// Edits in a control go into the settings; settings changed elsewhere (a branch being described, a ranking that
// stops being available) are written back to the controls.
export function bindTermControls(model) {
  for (const [key, [id, property, read]] of Object.entries(CONTROLS)) {
    $(`#${id}`).addEventListener('input', event => setTermSettings(model, { [key]: read(event.target[property]) }));
  }
  model.on(Events.TERM_SETTINGS, () => showTermSettingValues(model));
  showTermSettingValues(model);
}

export function showTermSettingValues(model) {
  for (const [key, [id, property]] of Object.entries(CONTROLS)) {
    const control = $(`#${id}`);
    const value = model.termSettings[key];
    // A select without the wanted option keeps its own value until its options are filled.
    if (control[property] !== value && String(control[property]) !== String(value)) { control[property] = value; }
  }
}
