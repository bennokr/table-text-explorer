// Nested JSON records become flat columns named by their path ("a.b.c"), like a search index does.
// Values collected from lists are merged into one text, one value per line. An object whose keys are
// themselves data (a phrase to a score) becomes the list of its keys. The nested original is not changed.
const KEYED_MIN = 30;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isEmpty = value => value === null || value === undefined || value === '';
const joinPath = (path, key) => (path ? `${path}.${key}` : key);

export const isNested = rows => rows.some(row => Object.values(row).some(value => value !== null && typeof value === 'object'));

// Object paths whose keys differ so much between records that the keys are values, not column names.
function keyedPaths(rows) {
  const keys = new Map();
  const visit = (value, path) => {
    if (Array.isArray(value)) { value.forEach(item => visit(item, path)); return; }
    if (!isObject(value)) { return; }
    const known = keys.get(path) ?? new Set();
    keys.set(path, known);
    for (const [key, child] of Object.entries(value)) { known.add(key); visit(child, joinPath(path, key)); }
  };
  rows.forEach(row => visit(row, ''));
  return new Set([...keys].filter(([path, known]) => path && known.size > KEYED_MIN).map(([path]) => path));
}

function add(found, path, values) {
  const entry = found.get(path) ?? { values: [] };
  entry.values.push(...values);
  found.set(path, entry);
}

// Every non-empty value of one record, grouped under its path.
function collect(value, path, state) {
  if (Array.isArray(value)) { value.forEach(item => collect(item, path, state)); return; }
  if (isObject(value) && state.keyed.has(path)) { add(state.found, path, Object.keys(value)); return; }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) { collect(child, joinPath(path, key), state); }
    return;
  }
  if (!isEmpty(value)) { add(state.found, path, [value]); }
}

// A cell is the value itself, or the strings of a list merged into one text; other lists have no flat form.
function cellOf({ values }) {
  if (values.length === 1) { return values[0]; }
  return values.every(value => typeof value === 'string') ? values.join('\n') : undefined;
}

function flatRow(row, keyed, skipped) {
  const state = { found: new Map(), keyed };
  collect(row, '', state);
  const cells = {};
  for (const [path, entry] of state.found) {
    const cell = cellOf(entry);
    if (cell === undefined) { skipped.add(path); } else { cells[path] = { cell, merged: entry.values.length > 1 }; }
  }
  return cells;
}

function kindOf(path, merged, keyed) {
  if (keyed.has(path)) { return 'keys'; }
  return merged.has(path) ? 'merged text' : 'value';
}

const summary = (path, rows, merged, keyed) => ({ path, kind: kindOf(path, merged, keyed),
  filled: rows.filter(row => !isEmpty(row[path])).length,
  example: String(rows.find(row => !isEmpty(row[path]))?.[path] ?? '') });

// The flat table, one summary per column, and the paths that have no flat form (lists of numbers or mixed lists).
export function flattenRecords(rows) {
  const keyed = keyedPaths(rows);
  const skipped = new Set();
  const merged = new Set();
  const records = rows.map(row => flatRow(row, keyed, skipped));
  const paths = [...new Set(records.flatMap(record => Object.keys(record)))].filter(path => !skipped.has(path));
  records.forEach(record => Object.entries(record).forEach(([path, { merged: listed }]) => { if (listed) { merged.add(path); } }));
  const flat = records.map(record => Object.fromEntries(paths.map(path => [path, record[path]?.cell ?? null])));
  return { rows: flat, columns: paths.map(path => summary(path, flat, merged, keyed)), skipped: [...skipped] };
}

// The table as read with its nested columns replaced by the flat ones.
export const flatTable = ({ flattened, ...table }) => ({ ...table, rows: flattened.rows, ignoredFields: flattened.skipped });
