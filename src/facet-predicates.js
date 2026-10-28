import { categorical, categoryLabel, missing, numberOf } from './schema.js';
import { temporal } from './dates.js';
import { missingPredicate, valuePredicate, rangePredicate } from './query-predicates.js';

function categoryPredicates(field, rows) {
  const values = new Map();
  rows.forEach((row, id) => {
    const value = row[field.name];
    if (missing(value, field)) { return; }
    // Equality queries are case-insensitive; combine the same equivalence classes.
    const key = String(value).toLocaleLowerCase();
    if (!values.has(key)) { values.set(key, { value, ids: [] }); }
    values.get(key).ids.push(id);
  });
  return [...values.values()].sort((a, b) => b.ids.length - a.ids.length).slice(0, 50)
    .map(({ value, ids }) => ({ label: categoryLabel(value, field), predicate: valuePredicate(field.name, value), ids }));
}

function cutpoints(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const cuts = [0.25, 0.5, 0.75].map(part => sorted[Math.floor((sorted.length - 1) * part)]);
  return [...new Set(cuts)].filter(value => Number.isFinite(value) && value < sorted.at(-1));
}

function rangeValue(value, field) {
  if (value === null) { return null; }
  if (temporal(field)) { return new Date(value).toISOString(); }
  return String(value);
}

function rangeLabel(lower, upper) {
  if (lower === null) { return `≤ ${upper}`; }
  if (upper === null) { return `> ${lower}`; }
  return `> ${lower} and ≤ ${upper}`;
}

function rangePredicates(field, rows) {
  const values = rows.map(row => numberOf(row[field.name], field));
  const cuts = cutpoints(values);
  if (!cuts.length) { return []; }
  const buckets = Array.from({ length: cuts.length + 1 }, () => []);
  values.forEach((value, id) => {
    if (!Number.isFinite(value)) { return; }
    const bin = cuts.findIndex(cut => value <= cut);
    buckets[bin < 0 ? cuts.length : bin].push(id);
  });
  return buckets.map((ids, index) => {
    const lower = rangeValue(index ? cuts[index - 1] : null, field);
    const upper = rangeValue(index < cuts.length ? cuts[index] : null, field);
    return { label: rangeLabel(lower, upper), predicate: rangePredicate(field.name, lower, upper), ids };
  });
}

export function facetField(field, rows) {
  let predicates = [];
  if (categorical(field)) { predicates = categoryPredicates(field, rows); }
  else if (field.kind === 'number' || temporal(field)) { predicates = rangePredicates(field, rows); }
  const ids = rows.flatMap((row, id) => missing(row[field.name], field) ? [id] : []);
  if (ids.length && ids.length < rows.length) {
    predicates.push({ label: 'Missing', predicate: missingPredicate(field.name), ids });
    predicates.push({ label: 'Not missing', predicate: { ...missingPredicate(field.name), op: '!=' },
      ids: rows.flatMap((row, id) => missing(row[field.name], field) ? [] : [id]) });
  }
  predicates = predicates.filter(item => item.ids.length < rows.length);
  return { name: field.name, label: field.label ?? field.title ?? field.name, predicates };
}
