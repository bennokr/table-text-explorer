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

export async function importTable(file) {
  const extension = file.name.split('.').at(-1).toLowerCase();
  const bytes = await file.arrayBuffer();
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
  return { ...result, name: file.name };
}

export async function importExample(name) {
  const response = await fetch(`/fixtures/${encodeURIComponent(name)}`);
  if (!response.ok) { throw new Error('Example is unavailable. Run npm run build to refresh fixtures.'); }
  return importTable(new File([await response.blob()], name));
}

export function exportTable(model, format, scope) {
  const ids = scope === 'all' ? model.rows.map((_, id) => id) : model.visible;
  const rows = ids.map(id => model.rows[id]);
  const names = model.fields.map(field => field.name);
  if (format === 'json') { return new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }); }
  if (format === 'csv') {
    return new Blob([Papa.unparse({ fields: names, data: rows.map(row => names.map(name => row[name])) })],
      { type: 'text/csv;charset=utf-8' });
  }
  const book = XLSX.utils.book_new();
  const serializable = rows.map(row => Object.fromEntries(names.map(name => [name,
    typeof row[name] === 'object' && row[name] !== null ? JSON.stringify(row[name]) : row[name]])));
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(serializable, { header: names }), 'Data');
  return new Blob([XLSX.write(book, { type: 'array', bookType: 'xlsx' })],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
