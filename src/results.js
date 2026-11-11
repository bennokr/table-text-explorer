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
  const colors = ['#3979a5', '#d9772b', '#648c51', '#9b62a7', '#c34e58', '#529e9e', '#9d823c', '#707ac1',
    '#8d6e4a', '#c25b9a', '#5b6b7a', '#8fb339'];
  return Object.fromEntries(ids.map(id => [id, { name: id === -1 ? 'Other' : `#${id + 1}`,
    color: id === -1 ? '#999999' : colors[id % colors.length] }]));
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
