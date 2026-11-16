import { categorical, categoryLabel, keyOf, missing, numberOf } from './schema.js';
import { HIGHLIGHT, UNASSIGNED } from './palette.js';

const DEFAULT_LIMIT = 29;
const MAX_STACK_COLORS = 12; // One per color of the palette; the rest share "Other".
const ISO_DATE = /^\d{4}(-\d{2}){0,2}/u;

function tally(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[field.name], key = keyOf(value, field);
    const entry = counts.get(key) ?? { key, value, label: categoryLabel(value, field), count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()];
}

const isMissingEntry = entry => entry.key === 'missing:';
const isNumberText = value => (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== ''
  && Number.isFinite(Number(value));

// Values that are all numbers, or all years, months or dates, read in their own order; any others by size.
// The entry for missing values goes last either way.
function naturalOrder(entries) {
  const known = entries.filter(entry => !isMissingEntry(entry));
  if (!known.length) { return null; }
  if (known.every(entry => isNumberText(entry.value))) { return (a, b) => Number(a.value) - Number(b.value); }
  if (known.every(entry => ISO_DATE.test(String(entry.value)))) {
    return (a, b) => String(a.value).localeCompare(String(b.value));
  }
  return null;
}

function arranged(entries, limit) {
  const kept = [...entries].sort((a, b) => b.count - a.count).slice(0, limit);
  const compare = naturalOrder(kept);
  if (!compare) { return kept; }
  const rank = entry => (isMissingEntry(entry) ? 1 : 0);
  return kept.sort((a, b) => rank(a) - rank(b) || compare(a, b));
}

// The biggest `limit` values in reading order, then "Other" for the rest. `values` are the raw values
// (undefined for "Other"), so a caller can look up their colors.
export function categories(rows, field, limit = DEFAULT_LIMIT) {
  const entries = tally(rows, field);
  // "Other" takes a row itself, so it only pays when it replaces at least two values.
  const kept = arranged(entries, entries.length <= limit + 1 ? entries.length : limit);
  const codes = new Map(kept.map((entry, index) => [entry.key, index]));
  const shown = entries.length > kept.length ? [...kept, { label: 'Other', key: null }] : kept;
  return { labels: shown.map(entry => entry.label), values: shown.map(entry => entry.value),
    codes: rows.map(row => codes.get(keyOf(row[field.name], field)) ?? shown.length - 1) };
}

// Sturges' rule, between 5 and 30 bins: enough to show a shape without a gap in every other bin.
export function automaticBins(count) {
  return Math.min(30, Math.max(5, Math.ceil(Math.log2(Math.max(count, 1)) + 1)));
}

function histogram(rows, field, bins) {
  const values = rows.map(row => field.kind === 'text' ?
    (missing(row[field.name]) ? NaN : String(row[field.name]).length) : numberOf(row[field.name], field));
  const finite = values.filter(Number.isFinite);
  const min = finite.reduce((a, b) => Math.min(a, b), Infinity);
  const max = finite.reduce((a, b) => Math.max(a, b), -Infinity);
  const start = finite.length ? min : 0;
  const count = max > min ? bins || automaticBins(finite.length) : 1;
  const width = max > min ? (max - min) / count : 1;
  const members = Array.from({ length: count }, () => []);
  const absent = [];
  values.forEach((value, id) => {
    if (!Number.isFinite(value)) { absent.push(id); return; }
    members[Math.min(count - 1, Math.floor((value - start) / width))].push(id);
  });
  return { kind: 'histogram', members, absent, data: {
    label: members.map((_, index) => `${(start + index * width).toPrecision(4)} – ${(start + (index + 1) * width).toPrecision(4)}`),
    left: members.map((_, index) => start + index * width),
    right: members.map((_, index) => start + (index + 1) * width) } };
}

// Bars read from the top down, so the first value gets the highest position.
const fromTop = (index, count) => count - 1 - index;

function category(rows, field, limit) {
  const x = categories(rows, field, limit);
  const members = x.labels.map(() => []);
  x.codes.forEach((code, id) => members[code].push(id));
  return { kind: 'category', members, absent: [], yLabels: [...x.labels].reverse(),
    data: { y: x.labels.map((_, index) => fromTop(index, x.labels.length)), label: x.labels } };
}

function segmentColor(stack, value) {
  return value === undefined ? UNASSIGNED : stack.colorOf(value) ?? UNASSIGNED;
}

// One bar per value of the first column, cut into segments by the values of the stack column.
function stacked(rows, field, stack, limit) {
  const bars = categories(rows, field, limit);
  const parts = categories(rows, stack.field, MAX_STACK_COLORS);
  const members = [], bar = [], labels = [], colors = [], y = [];
  bars.labels.forEach((label, i) => parts.labels.forEach((part, j) => {
    members.push([]); bar.push(i); labels.push(`${label} · ${part}`);
    colors.push(segmentColor(stack, parts.values[j])); y.push(fromTop(i, bars.labels.length));
  }));
  bars.codes.forEach((code, id) => members[code * parts.labels.length + parts.codes[id]].push(id));
  return { kind: 'stacked', members, absent: [], bar, yLabels: [...bars.labels].reverse(),
    data: { y, label: labels, color: colors } };
}

function heatmap(rows, fields, limits) {
  const x = categories(rows, fields[0], limits[0]);
  const y = categories(rows, fields[1], limits[1]);
  const members = [], xs = [], ys = [], labels = [];
  x.labels.forEach((label, i) => y.labels.forEach((other, j) => {
    members.push([]); xs.push(i); ys.push(j); labels.push(`${label} / ${other}`);
  }));
  x.codes.forEach((code, id) => members[code * y.labels.length + y.codes[id]].push(id));
  return { kind: 'heatmap', members, absent: [], xLabels: x.labels, yLabels: y.labels,
    data: { x: xs, y: ys, label: labels } };
}

// options: bins (histogram, 0 = automatic), limits (how many values fit along each category axis),
// stack ({ field, colorOf }: bars cut into segments by that column).
export function aggregate(rows, fields, options = {}) {
  const limits = options.limits ?? [DEFAULT_LIMIT, DEFAULT_LIMIT];
  if (fields.length === 1 && !categorical(fields[0])) { return histogram(rows, fields[0], options.bins); }
  if (fields.length === 1 && options.stack) { return stacked(rows, fields[0], options.stack, limits[0]); }
  if (fields.length === 1) { return category(rows, fields[0], limits[0]); }
  return heatmap(rows, fields, limits);
}

// Where each segment starts and ends along its bar, and a strip below it for the highlighted records.
function stackPositions(groups, count, selected) {
  const filled = new Map();
  const left = groups.bar.map((bar, index) => {
    const start = filled.get(bar) ?? 0;
    filled.set(bar, start + count[index]);
    return start;
  });
  return { left, right: left.map((start, index) => start + count[index]),
    strip: groups.data.y.map(y => y - 0.4), stripRight: left.map((start, index) => start + selected[index]) };
}

export function countsFor(groups, model) {
  const visible = new Set(model.visible);
  const members = groups.members.map(ids => ids.filter(id => visible.has(id)));
  const count = members.map(ids => ids.length);
  const selected = members.map(ids => ids.filter(id => model.selected.has(id)).length);
  const max = Math.max(1, ...count);
  const stack = groups.bar ? stackPositions(groups, count, selected) : {};
  return { ...groups.data, ...stack, count, selected, alpha: count.map(value => 0.08 + 0.92 * value / max),
    outline: selected.map(value => value ? HIGHLIGHT : '#ffffff') };
}
