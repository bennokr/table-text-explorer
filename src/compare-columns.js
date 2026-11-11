import { categorical, categoryLabel, missing, numberOf } from './schema.js';
import { temporal } from './dates.js';
import { rangePredicate, valuePredicate } from './query-predicates.js';
import { rangeValue } from './facet-predicates.js';

// A column is any partition of the records into values. These helpers turn table columns, annotations,
// clusterings and text axes into the same shape: per value, the records it holds and the records it is
// compared with, plus the condition a click on that value adds to the query path.
export const MIN_GROUP = 10;
export const MAX_VALUES = 8;
const PALETTE = ['#3979a5', '#d9772b', '#648c51', '#9b62a7', '#c34e58', '#529e9e', '#9d823c', '#707ac1'];
const OTHER = '#999999';
export const LOW = '#3979a5';
export const HIGH = '#c34e58';

const channel = (from, to, share) => Math.round(from + (to - from) * share);

// Ordered values run from blue through a neutral grey to red, so low and high read at a glance.
export function rampColors(count) {
  const [low, middle, high] = [[57, 121, 165], [170, 170, 170], [195, 78, 88]];
  return Array.from({ length: count }, (_, index) => {
    const share = count === 1 ? 0 : index / (count - 1);
    const [from, to, part] = share < 0.5 ? [low, middle, share * 2] : [middle, high, (share - 0.5) * 2];
    return `rgb(${from.map((value, channelIndex) => channel(value, to[channelIndex], part)).join(',')})`;
  });
}

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

function categoricalGroups(model, field, population) {
  const members = collectMembers(model, field, population);
  const observed = members.flatMap(group => group.ids);
  const large = members.filter(group => group.ids.length >= MIN_GROUP).sort((a, b) => b.ids.length - a.ids.length);
  // More values than colours: the biggest keep theirs and the rest, with every small group, share a grey "Other".
  const chosen = large.length > MAX_VALUES ? large.slice(0, MAX_VALUES - 1) : large;
  const ordered = chosen.every(group => Number.isFinite(Number(group.value)));
  if (ordered) { chosen.sort((a, b) => Number(a.value) - Number(b.value)); }
  const colors = ordered ? rampColors(chosen.length) : PALETTE;
  const groups = chosen.map((group, index) => {
    const inside = new Set(group.ids);
    return { id: String(index), name: categoryLabel(group.value, field), color: colors[index % colors.length],
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

// A text axis has no column to filter on, so a click on its side highlights the records directly.
export function axisGroups(axis) {
  return [
    { id: 'high', name: 'Side A', color: HIGH, subset: axis.high, comparison: axis.low, ids: axis.high },
    { id: 'low', name: 'Side B', color: LOW, subset: axis.low, comparison: axis.high, ids: axis.low },
  ];
}
