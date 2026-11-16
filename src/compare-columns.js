import { categorical, categoryLabel, missing, numberOf } from './schema.js';
import { temporal } from './dates.js';
import { rangePredicate, valuePredicate } from './query-predicates.js';
import { rangeValue } from './facet-predicates.js';
import { categoryColor, HIGH, LOW, OTHER } from './palette.js';
import { valueColor } from './value-colors.js';
import { legendNames } from './cluster-legend-data.js';

// A column is any partition of the records into values. These helpers turn table columns, annotations
// and clusterings into the same shape: per value, the records it holds and the records it is
// compared with, plus the condition a click on that value adds to the query path.
export const MIN_GROUP = 10;
const MAX_VALUES = 8;
const MAX_CLUSTERS = 12; // A clustering has as many colors as this, so its values are not collapsed into Other.

export function candidateFields(model) {
  const usable = field => categorical(field) || field.kind === 'number' || temporal(field);
  return model.fields.filter(field => !field.identifier && usable(field));
}

export function columnKind(field) {
  if (field.derived) { return 'Clusters'; }
  return field.annotation ? 'Annotations' : 'Columns';
}

// What the worker needs, aligned to the population: group codes (-1 = missing) or numbers (null = missing).
export function columnPayload(model, field, population) {
  if (!categorical(field)) {
    const values = population.map(id => numberOf(model.rows[id][field.name], field));
    return { name: field.name, kind: 'numeric', values: values.map(value => (Number.isFinite(value) ? value : null)) };
  }
  const codes = new Map();
  const list = population.map(id => {
    const value = model.rows[id][field.name];
    if (missing(value, field)) { return -1; }
    const key = String(value).toLocaleLowerCase();
    if (!codes.has(key)) { codes.set(key, codes.size); }
    return codes.get(key);
  });
  return { name: field.name, kind: 'categorical', codes: list };
}

function collectMembers(model, field, population) {
  const members = new Map();
  for (const id of population) {
    const value = model.rows[id][field.name];
    if (missing(value, field)) { continue; }
    const key = String(value).toLocaleLowerCase();
    if (!members.has(key)) { members.set(key, { value, ids: [] }); }
    members.get(key).ids.push(id);
  }
  return [...members.values()];
}

// Clusters follow their legend card, not their size, so a color key above the cloud reads like the legend.
function legendOrder(model, field) {
  const result = model.results.get(field.derived);
  if (!result?.groups) { return () => 0; }
  const names = legendNames(result);
  const position = group => names.indexOf(String(group.value));
  return (a, b) => position(a) - position(b);
}

function categoricalGroups(model, field, population) {
  const members = collectMembers(model, field, population);
  const observed = members.flatMap(group => group.ids);
  const large = members.filter(group => group.ids.length >= MIN_GROUP).sort((a, b) => b.ids.length - a.ids.length);
  // More values than colors: the biggest keep theirs and the rest, with every small group, share a grey "Other".
  const limit = field.derived ? MAX_CLUSTERS : MAX_VALUES;
  const chosen = large.length > limit ? large.slice(0, limit - 1) : large;
  if (field.derived) { chosen.sort(legendOrder(model, field)); }
  else if (chosen.every(group => Number.isFinite(Number(group.value)))) { chosen.sort((a, b) => Number(a.value) - Number(b.value)); }
  const colorOf = valueColor(model, field);
  const groups = chosen.map((group, index) => {
    const inside = new Set(group.ids);
    return { id: String(index), name: categoryLabel(group.value, field), color: colorOf(group.value) ?? categoryColor(index),
      subset: group.ids, comparison: observed.filter(id => !inside.has(id)), predicate: valuePredicate(field.name, group.value) };
  });
  const shown = new Set(chosen.flatMap(group => group.ids));
  const rest = observed.filter(id => !shown.has(id));
  if (rest.length < MIN_GROUP) { return groups; }
  return [...groups, { id: 'other', name: 'Other values', color: OTHER, subset: rest, ids: rest, comparison: [...shown] }];
}

const quantile = (sorted, part) => sorted[Math.floor((sorted.length - 1) * part)];

function numberText(value, field) {
  return temporal(field) ? new Date(value).toISOString().slice(0, 10) : String(value);
}

// A number is compared at its extremes: the lowest quarter against the highest quarter.
function numericGroups(model, field, population) {
  const observed = population.map(id => [id, numberOf(model.rows[id][field.name], field)]).filter(([, value]) => Number.isFinite(value));
  const sorted = observed.map(([, value]) => value).sort((a, b) => a - b);
  const [low, high] = [quantile(sorted, 0.25), quantile(sorted, 0.75)];
  if (!(low < high)) { return []; }
  const lows = observed.filter(([, value]) => value <= low).map(([id]) => id);
  const highs = observed.filter(([, value]) => value > high).map(([id]) => id);
  return [
    { id: 'low', name: `≤ ${numberText(low, field)}`, color: LOW, subset: lows, comparison: highs,
      predicate: rangePredicate(field.name, null, rangeValue(low, field)) },
    { id: 'high', name: `> ${numberText(high, field)}`, color: HIGH, subset: highs, comparison: lows,
      predicate: rangePredicate(field.name, rangeValue(high, field), null) },
  ];
}

export function fieldGroups(model, field, population) {
  return categorical(field) ? categoricalGroups(model, field, population) : numericGroups(model, field, population);
}
