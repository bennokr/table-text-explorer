import { categorical, categoryLabel, keyOf, missing, numberOf } from './schema.js';

function categories(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[field.name], key = keyOf(value);
    const entry = counts.get(key) ?? { key, label: categoryLabel(value, field), count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  const entries = [...counts.values()].sort((a, b) => b.count - a.count);
  const top = entries.slice(0, 29);
  const codes = new Map(top.map((entry, index) => [entry.key, index]));
  if (entries.length > 29) { top.push({ label: 'Other', key: null }); }
  return { labels: top.map(entry => entry.label),
    codes: rows.map(row => codes.get(keyOf(row[field.name])) ?? top.length - 1) };
}

function histogram(rows, field) {
  const values = rows.map(row => field.kind === 'text' ?
    (missing(row[field.name]) ? NaN : String(row[field.name]).length) : numberOf(row[field.name], field));
  const finite = values.filter(Number.isFinite);
  const min = finite.reduce((a, b) => Math.min(a, b), Infinity);
  const max = finite.reduce((a, b) => Math.max(a, b), -Infinity);
  const start = finite.length ? min : 0;
  const width = max > min ? (max - min) / 16 : 1;
  const count = max > min ? 16 : 1;
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

export function aggregate(rows, fields) {
  if (fields.length === 1 && !categorical(fields[0])) { return histogram(rows, fields[0]); }
  const x = categories(rows, fields[0]);
  if (fields.length === 1) {
    const members = x.labels.map(() => []);
    x.codes.forEach((code, id) => members[code].push(id));
    return { kind: 'category', members, absent: [], yLabels: x.labels,
      data: { y: x.labels.map((_, index) => index), label: x.labels } };
  }
  const y = categories(rows, fields[1]);
  const members = [], xs = [], ys = [], labels = [];
  x.labels.forEach((label, i) => y.labels.forEach((other, j) => {
    members.push([]); xs.push(i); ys.push(j); labels.push(`${label} / ${other}`);
  }));
  x.codes.forEach((code, id) => members[code * y.labels.length + y.codes[id]].push(id));
  return { kind: 'heatmap', members, absent: [], xLabels: x.labels, yLabels: y.labels,
    data: { x: xs, y: ys, label: labels } };
}

export function countsFor(groups, model) {
  const visible = new Set(model.visible);
  const members = groups.members.map(ids => ids.filter(id => visible.has(id)));
  const count = members.map(ids => ids.length);
  const selected = members.map(ids => ids.filter(id => model.selected.has(id)).length);
  const max = Math.max(1, ...count);
  return { ...groups.data, count, selected, alpha: count.map(value => 0.08 + 0.92 * value / max),
    outline: selected.map(value => value ? '#d9772b' : '#ffffff') };
}
