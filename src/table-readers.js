import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { readSav } from '@irbisadm/statfmt';

function jsonRecords(text) {
  const rows = JSON.parse(text);
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('JSON must contain an array of record objects.');
  }
  return rows;
}

function readCsv(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
  if (result.errors.length) { throw new Error(`CSV: ${result.errors[0].message}`); }
  return result.data;
}

function readExcel(bytes) {
  const book = XLSX.read(bytes, { cellDates: true });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: null });
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
    [key, value instanceof Date ? value.toISOString() : value])));
}

export function parseTable(bytes, name) {
  const extension = name.split('.').at(-1).toLowerCase();
  const text = () => new TextDecoder().decode(bytes);
  const readers = { csv: () => ({ rows: readCsv(text()) }),
    json: () => ({ rows: jsonRecords(text()) }),
    xlsx: () => ({ rows: readExcel(bytes) }),
    sav: () => {
      const data = readSav(new Uint8Array(bytes));
      return { rows: data.toObjects(), metadata: Object.fromEntries(
        data.variables.map(field => [field.name, field])) };
    } };
  if (!Object.hasOwn(readers, extension)) { throw new Error('Choose a CSV, JSON records, SAV or XLSX file.'); }
  const result = readers[extension]();
  if (!result.rows.length) { throw new Error('The table contains no records.'); }
  return { ...result, name };
}
