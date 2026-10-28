import * as XLSX from 'xlsx';

const profile = 'https://datapackage.org/profiles/2.0/tableschema.json';
const rows = (book, name) => book.Sheets[name] ? XLSX.utils.sheet_to_json(book.Sheets[name], { defval: '' }) : [];
const present = value => value !== '' && value !== undefined;

function definition(row) {
  const field = { name: row.name };
  for (const key of ['title', 'description', 'type', 'format', 'categoriesOrdered']) {
    if (present(row[key])) { field[key] = row[key]; }
  }
  for (const key of ['measurement', 'role', 'group', 'unit', 'concept_uri']) {
    if (present(row[key])) { field[`x-${key}`] = row[key]; }
  }
  const constraints = Object.fromEntries(['minimum', 'maximum', 'pattern'].filter(key => present(row[key])).map(key => [key, row[key]]));
  if (Object.keys(constraints).length) { field.constraints = constraints; }
  return field;
}

function valueDefinitions(values, fields) {
  for (const row of values.sort((a, b) => Number(a.order) - Number(b.order))) {
    const field = fields.get(row.field);
    if (!field) { throw new Error(`Unknown Values field: ${row.field}`); }
    if (row.is_missing === true) { addMissing(field, row); continue; }
    const value = ['integer', 'number', 'year'].includes(field.type) ? Number(row.value) : String(row.value);
    const item = { value };
    if (row.label) { item.label = row.label; }
    const key = row.closed === false ? 'x-valueLabels' : 'categories';
    field[key] ??= [];
    field[key].push(item);
  }
}

function addMissing(target, row) {
  target.missingValues ??= [];
  target.missingValues.push({ value: String(row.value), label: row.label || 'Missing' });
}

// Version 1 spreadsheet profile: plain rows, no JSON inside cells.
export function readCodebook(bytes) {
  const book = XLSX.read(bytes);
  if (!book.Sheets.Fields) { throw new Error('Codebook requires a Fields sheet.'); }
  const definitions = rows(book, 'Fields').map(definition);
  const fields = new Map(definitions.map(field => [field.name, field]));
  if (fields.size !== definitions.length || definitions.some(field => typeof field.name !== 'string' || !field.name.trim())) {
    throw new Error('Field names must be nonempty strings and unique.');
  }
  const schema = { $schema: profile, fieldsMatch: 'partial', fields: definitions };
  valueDefinitions(rows(book, 'Values'), fields);
  for (const row of rows(book, 'Missing')) {
    const target = row.field === '*' ? schema : fields.get(row.field);
    if (!target) { throw new Error(`Unknown Missing field: ${row.field}`); }
    addMissing(target, row);
  }
  const keys = rows(book, 'Dataset').filter(row => row.key === 'primaryKey').map(row => String(row.value));
  if (keys.length) { schema.primaryKey = keys; }
  schema['x-groups'] = rows(book, 'Groups');
  schema['x-reviewNotes'] = rows(book, 'Review').map(row => row.note);
  return schema;
}
