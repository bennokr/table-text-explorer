import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { profileOf, schemaOf, workbookOf } from './migrate_schema.mjs';

const directory = 'demo-config/RMC_synthetische_data_20_rijen.xlsx';
const source = 'Codeboek RMC_aangepast22-10.xlsx';
const bytes = await readFile(source);
const review = JSON.parse(await readFile(`${directory}/review.json`, 'utf8'));
const book = XLSX.read(bytes);
const fields = new Map();

function addValue(field, label, code) {
  if (code === null || code === '' || !Number.isInteger(Number(code))) { return; }
  field.categories ??= [];
  const value = Number(code);
  if (field.categories.some(item => item.value === value)) { return; }
  const item = { value };
  if (label) { item.label = String(label).trim(); }
  field.categories.push(item);
}

function fieldDefinition(name, row, columns, context) {
  const type = context.type || '';
  const field = { name, title: row[columns.question] ?? context.question ?? name,
    type: String(type).startsWith('A') ? 'string' : 'integer', 'x-group': context.group,
    'x-source': { sheet: context.sheet, row: context.row, type } };
  if (field.type === 'string') { field['x-role'] = 'text'; }
  const range = /^(\d+)\s*-\s*(\d+)$/.exec(String(row[columns.code] ?? ''));
  if (range) { field.constraints = { minimum: Number(range[1]), maximum: Number(range[2]) }; }
  return field;
}

function updateContext(row, columns, context) {
  if (row[columns.question]) {
    context.question = row[columns.question];
    if (!row[columns.name] && String(context.question) === String(context.question).toUpperCase()) {
      context.group = `${context.sheet}: ${context.question}`;
    }
  }
  if (row[columns.type]) { context.type = row[columns.type]; }
}

function sheetFields(sheet) {
  const tab = book.Sheets[sheet];
  const rows = XLSX.utils.sheet_to_json(tab, { header: 1, defval: null });
  const header = rows[0].map(value => String(value ?? '').trim());
  const columns = Object.fromEntries(Object.entries({ name: 'Variabele naam', question: 'Vraagtekst',
    type: 'Type', label: 'Waarden', code: 'Codering/bereik' }).map(([key, value]) => [key, header.indexOf(value)]));
  const context = { sheet, group: sheet };
  let field;
  rows.slice(1).forEach((row, index) => {
    context.row = index + XLSX.utils.decode_range(tab['!ref']).s.r + 2;
    updateContext(row, columns, context);
    const name = row[columns.name]?.trim();
    if (!name && row[columns.question]) { field = null; }
    if (name) {
      field = fieldDefinition(name, row, columns, context);
      if (fields.has(name)) { field = null; } else { fields.set(name, field); }
    }
    if (field) { addValue(field, row[columns.label], row[columns.code]); }
  });
}

function applyReview() {
  for (const [name, patch] of Object.entries(review.fields)) {
    Object.assign(fields.get(name), patch);
  }
  for (const name of review.partialFields) {
    const field = fields.get(name);
    field['x-valueLabels'] = field.categories;
    field.categories = null;
    field['x-measurement'] = 'ordinal';
  }
  const shared = fields.get(review.sharedCategories.source).categories;
  for (const name of review.sharedCategories.fields) {
    Object.assign(fields.get(name), { categories: shared, categoriesOrdered: true, 'x-measurement': 'ordinal' });
  }
  for (const field of fields.values()) {
    for (const key of Object.keys(field)) { if (field[key] === null) { delete field[key]; } }
  }
}

for (const sheet of book.SheetNames) { sheetFields(sheet); }
applyReview();
const definitions = [...fields.values()];
for (const [index, field] of definitions.entries()) {
  if (field.name.endsWith('Toel')) { field.description = `Toelichting: ${definitions[index - 2].title.trim()}`; }
}
const schema = { primaryKey: ['ResPno'], fields: definitions };
const profile = profileOf(schema);
const output = { ...schemaOf(profile), 'x-source': { filename: source, sha256: createHash('sha256').update(bytes).digest('hex') },
  'x-reviewNotes': review.notes };
await writeFile(`${directory}/schema.metadata.json`, JSON.stringify(output, null, 2) + '\n');
await writeFile(`${directory}/codebook.xlsx`, workbookOf(profile));
console.log(`Prepared ${fields.size} RMC variable definitions, JSON and spreadsheet profile; no records included.`);
