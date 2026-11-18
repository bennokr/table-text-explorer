import { CELL, routingStates } from './routing.js';

// Columns that describe how each record was answered. They are computed from the codebook's `applies_when` rules,
// read-only, and never part of an analysis unless a person chooses them.
export const PROFILE = { answered: 'Answered', skipped: 'Skipped', notShown: 'Not shown',
  texts: 'Text answers', hasText: 'Has text' };

const original = field => !field.derived && !field.annotation && !field.computed;

function count(states, rowIndex, state) {
  return states.filter(column => column[rowIndex] === state).length;
}

function profileRow(columns, textColumns, rowIndex) {
  const texts = count(textColumns, rowIndex, CELL.answered);
  return { [PROFILE.answered]: count(columns, rowIndex, CELL.answered),
    [PROFILE.skipped]: count(columns, rowIndex, CELL.skipped),
    [PROFILE.notShown]: count(columns, rowIndex, CELL.notShown),
    [PROFILE.texts]: texts, [PROFILE.hasText]: texts ? 'yes' : 'no' };
}

function profileField(model, name, kind) {
  const values = model.rows.map(row => row[name]);
  return { name, kind, storage: kind === 'number' ? 'number' : 'string', computed: 'response-profile',
    identifier: false, unique: [...new Set(values)], count: values.length, missing: 0, empty: false,
    constant: new Set(values).size === 1, valueLabels: [] };
}

// Adds the profile columns when at least one column has an `applies_when` rule. Original values are untouched.
export function addResponseProfile(model) {
  const fields = model.fields.filter(original);
  if (!fields.some(field => field.appliesWhen) || fields.some(field => field.name in PROFILE)) { return; }
  const { states } = routingStates(model.rows, fields);
  const columns = [...states.values()];
  const textColumns = fields.filter(field => field.kind === 'text').map(field => states.get(field.name));
  model.rows.forEach((row, index) => {
    for (const [name, value] of Object.entries(profileRow(columns, textColumns, index))) {
      Object.defineProperty(row, name, { value, enumerable: true, writable: false, configurable: true });
    }
  });
  const kinds = { [PROFILE.hasText]: 'categorical' };
  model.fields.push(...Object.values(PROFILE).map(name => profileField(model, name, kinds[name] ?? 'number')));
}
