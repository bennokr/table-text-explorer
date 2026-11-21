import { flattenRecords, isNested } from './flatten.js';
import { scalarColumns } from './table-values.js';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { readSav } from '@irbisadm/statfmt';

function jsonRecords(text) { return checkedRecords(JSON.parse(text)); }

// JSON Lines: one record object per line; blank lines are skipped.
function jsonLines(text) {
  const rows = text.split(/\r?\n/u).map((line, index) => ({ line: index + 1, text: line.trim() })).filter(item => item.text)
    .map(item => {
      try { return JSON.parse(item.text); } catch (error) { throw new Error(`JSON Lines: line ${item.line}: ${error.message}`, { cause: error }); }
    });
  return checkedRecords(rows);
}

function checkedRecords(rows) {
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('JSON must contain an array of record objects (or one record per line in a .jsonl file).');
  }
  return rows;
}

function readCsv(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
  if (result.errors.length) { throw new Error(`CSV: ${result.errors[0].message}`); }
  return result.data;
}

function excelDate(cell, date1904) {
  const parts = XLSX.SSF.parse_date_code(cell.v, { date1904 });
  if (!parts) { return null; }
  const value = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, parts.H, parts.M, parts.S, Math.round(parts.u * 1000))).toISOString();
  const format = cell.z.replace(/"[^"]*"|\\./g, '');
  return /[hs]/i.test(format) ? value : value.slice(0, 10);
}

function readExcel(bytes) {
  // Excel stores wall-clock serials, not timezone-aware timestamps.
  const book = XLSX.read(bytes, { cellDates: false, cellNF: true });
  const sheet = book.Sheets[book.SheetNames[0]];
  for (const cell of Object.values(sheet)) {
    if (cell?.t === 'n' && XLSX.SSF.is_date(cell.z)) {
      cell.v = excelDate(cell, book.Workbook?.WBProps?.date1904);
      cell.t = 's';
      delete cell.z;
    }
  }
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
}

export function parseTable(bytes, name) {
  const extension = name.split('.').at(-1).toLowerCase();
  const text = () => new TextDecoder().decode(bytes);
  const readers = { csv: () => ({ rows: readCsv(text()) }),
    json: () => ({ rows: jsonRecords(text()) }),
    jsonl: () => ({ rows: jsonLines(text()) }),
    xlsx: () => ({ rows: readExcel(bytes) }),
    sav: () => {
      const data = readSav(new Uint8Array(bytes));
      return { rows: data.toObjects(), metadata: Object.fromEntries(
        data.variables.map(field => [field.name, field])) };
    } };
  if (!Object.hasOwn(readers, extension)) { throw new Error('Choose a CSV, JSON, JSON Lines, SAV or XLSX file.'); }
  const result = readers[extension]();
  if (!result.rows.length) { throw new Error('The table contains no records.'); }
  const flattened = isNested(result.rows) ? { flattened: flattenRecords(result.rows) } : {};
  return { ...result, ...scalarColumns(result.rows), ...flattened, name };
}
