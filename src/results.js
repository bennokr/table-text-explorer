import { categoryColor, OTHER } from './palette.js';
// Numeric arrays and memberships live here, never in imported records or cards.
export class Results {
  items = new Map();
  sequence = 0;

  add(kind, data) {
    const id = `result-${++this.sequence}`;
    const result = { ...data, id, kind, name: data.name ?? `${data.method ?? kind} ${this.sequence}`,
      created: new Date().toISOString() };
    this.items.set(id, result);
    return result;
  }

  get(id) { return this.items.get(id); }
  list(kind) { return [...this.items.values()].filter(item => !kind || item.kind === kind); }
}

function uniqueColumn(model, suggested) {
  let name = suggested, suffix = 2;
  while (model.fields.some(field => field.name === name)) { name = `${suggested} ${suffix++}`; }
  return name;
}

export function clusterGroups(labels) {
  const ids = [...new Set(labels)].sort((a, b) => a - b);
  return Object.fromEntries(ids.map(id => [id, { name: id === -1 ? 'Other' : `#${id + 1}`,
    color: id === -1 ? OTHER : categoryColor(id) }]));
}

export function clusterColumns(model, result) {
  const positions = new Map(result.rowIds.map((id, index) => [id, index]));
  const label = id => result.labels[positions.get(id)] ?? null;
  result.columns = { name: uniqueColumn(model, `${result.name} · name`) };
  addColumn(model, result.columns.name, result, id => result.groups[label(id)]?.name ?? null);
}

function addColumn(model, name, result, read) {
  // Read-only virtual columns preserve original values and keep memberships in the run.
  model.rows.forEach((row, id) => Object.defineProperty(row, name,
    { enumerable: true, configurable: true, get: () => read(id) }));
  model.fields.push({ name, kind: 'categorical', storage: 'string', derived: result.id,
    identifier: false, unique: [...new Set(model.rows.map(row => row[name]))],
    missing: model.rows.length - result.rowIds.length, valueLabels: [] });
}

export function resultExport(result) {
  const { x, y, embeddings, ...metadata } = result;
  const output = { ...metadata, rowIdConvention: 'Zero-based positions in the imported table' };
  if (x && y) { output.coordinates = result.rowIds.map(id => [x.values[id], y.values[id]]); }
  if (embeddings) { output.embeddings = Array.from(embeddings); }
  return new Blob([JSON.stringify(output)], { type: 'application/json' });
}
