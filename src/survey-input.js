import { featureFields } from './features.js';
import { groupName } from './group-vectors.js';
import { CELL, routingStates } from './routing.js';
import { numberOf } from './schema.js';
import { weightOf } from './word-vectors.js';

const cache = new WeakMap();
const original = field => !field.derived && !field.computed && !field.annotation;

// How each kind of column is compared: dates are numbers; booleans and categories only match or differ.
const comparison = { number: 'numeric', date: 'numeric', datetime: 'numeric' };
// How much of the map a map of the blank answers alone would also show (see docs/help/survey.md).
export function surveyNote(survey) {
  if (!survey) { return ''; }
  return ` · ${survey.neighboursSharedWithMissingness} of nearest neighbours shared with a map of blanks alone (chance ${survey.chance})`;
}

export const isText = field => field.kind === 'text';

// The state of every cell, from the codebook's applies_when rules. Computed once per table and schema.
export function cellStates(model) {
  const key = `${model.revision}:${model.schemaRevision}`;
  if (cache.get(model)?.key !== key) {
    cache.set(model, { key, value: routingStates(model.rows, model.fields.filter(original)) });
  }
  return cache.get(model).value;
}

// How many cells of the chosen columns are answered, skipped, not shown or unknown, and how many columns have a rule.
export function stateCounts(model, fields) {
  const { states } = cellStates(model);
  const counts = { answered: 0, skipped: 0, notShown: 0, unknown: 0, rules: fields.filter(field => field.appliesWhen).length };
  const names = { [CELL.answered]: 'answered', [CELL.skipped]: 'skipped', [CELL.notShown]: 'notShown', [CELL.unknown]: 'unknown' };
  for (const field of fields) {
    for (const state of states.get(field.name)) { counts[names[state]] += 1; }
  }
  return counts;
}

// A category is a code; the values themselves never matter, only whether two records have the same one.
function columnValues(model, field, kind) {
  if (kind === 'numeric') {
    return model.rows.map(row => { const value = numberOf(row[field.name], field); return Number.isFinite(value) ? value : null; });
  }
  const codes = new Map();
  return model.rows.map(row => {
    const key = String(row[field.name]);
    if (!codes.has(key)) { codes.set(key, codes.size); }
    return codes.get(key);
  });
}

// A closed list the codebook calls ordinal is compared by position in that list, so "agree" is nearer "strongly agree" than "disagree".
function ordinalRanks(model, field) {
  if (field.level !== 'ordinal' || field.valueLabels.length < 2) { return null; }
  const order = field.valueLabels.map(pair => pair.value);
  const listed = model.rows.every(row => isBlank(row[field.name]) || order.includes(row[field.name]));
  if (!listed) { return null; }
  return { ranks: model.rows.map(row => { const rank = order.indexOf(row[field.name]); return rank < 0 ? null : rank; }), last: order.length - 1 };
}

const isBlank = value => value === null || value === undefined || value === '';

// The first and last value a numeric or ordinal column can take, when it is known without looking at the answers.
function scaleOf(field, kind, ordinal) {
  if (ordinal) { return { low: 0, high: ordinal.last }; }
  const { minimum, maximum } = field.constraints ?? {};
  return kind === 'numeric' && Number.isFinite(minimum) && Number.isFinite(maximum) ? { low: minimum, high: maximum } : {};
}

function surveyColumn(model, field, states) {
  const ordinal = ordinalRanks(model, field);
  const kind = ordinal ? 'ordinal' : comparison[field.kind] ?? 'nominal';
  return { name: field.name, kind, group: groupName(field),
    weight: weightOf(model.config.weights, field.name), values: ordinal ? ordinal.ranks : columnValues(model, field, kind),
    states: states.get(field.name), ...scaleOf(field, kind, ordinal) };
}

export function surveyTextFields(model) { return featureFields(model).filter(isText); }

// Free text is embedded by the sentence model with each column's question in front, one mean vector per record.
export function surveyTextModel(model) {
  const names = surveyTextFields(model).map(field => field.name);
  const config = { ...model.config, mode: 'sentences', features: names, combine: 'mean', includeDescriptions: true };
  return Object.assign(Object.create(model), { config });
}

const MIN_SUPPORT = 3;
const MAX_VALUES = 30;

function answerLabel(field, value) {
  return field.valueLabels.find(pair => pair.value === value)?.label ?? String(value);
}

// Every answer to a question that has a handful of values, with the records that gave it; a cluster is named by the ones it favours.
export function surveyAnswers(model, config) {
  const { states } = cellStates(model);
  const answers = [];
  for (const field of featureFields({ fields: model.fields, config }).filter(item => !isText(item) && !comparison[item.kind])) {
    const given = new Map();
    states.get(field.name).forEach((state, row) => {
      if (state !== CELL.answered) { return; }
      const value = model.rows[row][field.name];
      given.set(value, [...(given.get(value) ?? []), row]);
    });
    if (given.size > MAX_VALUES) { continue; }
    const question = field.label ?? field.name;
    for (const [value, ids] of given) {
      if (ids.length >= MIN_SUPPORT) { answers.push({ question, text: `${question}: ${answerLabel(field, value)}`, ids }); }
    }
  }
  return answers;
}

export function surveyRequest(model, textRows) {
  const { states } = cellStates(model);
  const fields = featureFields(model);
  return { task: 'survey_prepare', rows: model.rows.length, options: model.config.survey, textRows,
    columns: fields.filter(field => !isText(field)).map(field => surveyColumn(model, field, states)),
    textColumns: fields.filter(isText).map(field => ({ name: field.name, states: states.get(field.name) })) };
}
