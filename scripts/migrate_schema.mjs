// Turns a Table Schema written with the earlier extensions (x-role, x-measurement, x-group, x-valueLabels) into a
// linked-codebook profile, and from there into the Table Schema the application reads now.
//   node scripts/migrate_schema.mjs old.metadata.json new.metadata.json [codebook.xlsx]
import { readFile, writeFile } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { tableSpec, toFrictionless, toTables } from 'linked-codebook';

const schemaProfile = 'https://datapackage.org/profiles/2.0/tableschema.json';
const levels = new Set(['nominal', 'ordinal']);
const codeOf = item => String(typeof item === 'object' ? item.value : item);
const entry = (item, extra = {}) => ({ code: codeOf(item), label: typeof item === 'object' ? item.label : undefined, ...extra });

function valuesOf(field) {
  const closed = (field.categories ?? []).map(item => entry(item));
  const partial = (field['x-valueLabels'] ?? []).map(item => entry(item));
  const missing = (field.missingValues ?? []).filter(item => item !== '').map(item => entry(item, { missing: true }));
  return { values: [...closed, ...partial, ...missing], closed: field.categories ? true : undefined };
}

export function columnOf(field, keys = []) {
  const limits = field.constraints ?? {};
  const level = field['x-measurement'];
  return clean({ name: field.name, label: field.title, description: field.description, datatype: field.type,
    format: field.format, level: levels.has(level) ? level : undefined, group: field['x-group'],
    identifying: field['x-role'] === 'identifier' || keys.includes(field.name) || undefined, minimum: limits.minimum, maximum: limits.maximum,
    ...valuesOf(field) });
}

const clean = object => Object.fromEntries(Object.entries(object).filter(([, value]) =>
  value !== undefined && !(Array.isArray(value) && !value.length)));

export const profileOf = schema => ({ columns: schema.fields.map(field => columnOf(field, [].concat(schema.primaryKey ?? []))) });

// linked-codebook writes every cell as text; a workbook should hold numbers and booleans as such.
function typedCell(kind, cell) {
  if (cell === '') { return null; }
  if (kind === 'number' || kind === 'integer') { return Number(cell); }
  return kind === 'boolean' ? cell === 'true' : cell;
}

function typedRows(name, rows) {
  const spec = Object.values(tableSpec.sheets).find(candidate => candidate.title === name);
  const kinds = rows[0].map(header => spec?.kinds[header] ?? 'text');
  return [rows[0], ...rows.slice(1).map(row => row.map((cell, index) => typedCell(kinds[index], cell)))];
}

export function workbookOf(profile) {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(toTables(profile))) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(typedRows(name, rows)), name);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true });
}

export const schemaOf = profile => ({ $schema: schemaProfile, fieldsMatch: 'partial', ...toFrictionless(profile) });

if (process.argv[1]?.endsWith('migrate_schema.mjs')) {
  const [source, destination, workbook] = process.argv.slice(2);
  if (!source || !destination) { throw new Error('Usage: node scripts/migrate_schema.mjs old.json new.json [codebook.xlsx]'); }
  const profile = profileOf(JSON.parse(await readFile(source, 'utf8')));
  await writeFile(destination, JSON.stringify(schemaOf(profile), null, 2) + '\n');
  if (workbook) { await writeFile(workbook, workbookOf(profile)); }
  console.log(`Migrated ${profile.columns.length} variable definitions.`);
}
