import * as XLSX from 'xlsx';
import { fromTables, tableSpec, tableWarnings, toFrictionless } from 'linked-codebook';

const schemaProfile = 'https://datapackage.org/profiles/2.0/tableschema.json';
const plain = cell => cell instanceof Date ? cell.toISOString().slice(0, 10) : cell;
const normalize = name => String(name).toLowerCase().replace(/[^a-z0-9]/gu, '');
const sheetSpecs = Object.values(tableSpec.sheets);

// Cells as the workbook holds them: numbers stay numbers and dates stay dates, so that a cell whose type does not
// match its header can be reported. linked-codebook turns every cell into text or a number as its header says.
function grid(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: false });
}

const textual = kind => kind === 'text' || /^[A-Z]/u.test(kind);

// Why a cell does not suit its header. Excel silently changes what people type: numbers lose leading zeros and
// trailing decimals, and values that look like dates become dates.
const rules = [
  [cell => cell instanceof Date, cell => `${plain(cell)} is a date; write it as text`],
  [(cell, kind) => textual(kind) && typeof cell !== 'string',
    cell => `${cell} is a ${typeof cell} but this header takes text; write it as text so that leading zeros survive`],
  [(cell, kind) => ['number', 'integer'].includes(kind) && typeof cell === 'string',
    cell => `"${cell}" is text but this header takes a number`],
  [(cell, kind) => kind === 'boolean' && typeof cell === 'number', cell => `${cell} is a number; use TRUE or FALSE`],
];

function mismatch(kind, cell) {
  if (cell === null || cell === '') { return ''; }
  const rule = rules.find(([applies]) => applies(cell, kind));
  return rule ? rule[1](cell) : '';
}

function sheetWarnings(spec, rows) {
  const heads = (rows[0] ?? []).map(normalize);
  return rows.slice(1).flatMap((row, index) => spec.headers.flatMap(header => {
    const at = heads.indexOf(normalize(header));
    const reason = at < 0 ? '' : mismatch(spec.kinds[header], row[at]);
    return reason ? [`${spec.title} row ${index + 2}, ${header}: ${reason}`] : [];
  }));
}

// Every warning names the sheet, the row and the header, because a spreadsheet silently changes what people type.
export function cellWarnings(tables) {
  return Object.entries(tables).flatMap(([name, rows]) => {
    const spec = sheetSpecs.find(candidate => normalize(candidate.title) === normalize(name));
    return spec ? sheetWarnings(spec, rows) : [];
  });
}

export function codebookTables(bytes) {
  const book = XLSX.read(bytes, { cellDates: true });
  return Object.fromEntries(book.SheetNames.map(name => [name, grid(book.Sheets[name])]));
}

// Reads a workbook into a Table Schema. Warnings are passed to `onWarning`; with `strict` they are an error.
export function readCodebook(bytes, { onWarning = message => console.warn(`codebook warning: ${message}`), strict = false } = {}) {
  const tables = codebookTables(bytes);
  const warnings = [...tableWarnings(tables), ...cellWarnings(tables)];
  if (strict && warnings.length) { throw new Error(`Codebook has ${warnings.length} warnings:\n${warnings.join('\n')}`); }
  warnings.forEach(onWarning);
  const cells = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.map(row => row.map(plain))]));
  return { $schema: schemaProfile, fieldsMatch: 'partial', ...toFrictionless(fromTables(cells)) };
}
