import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Workers } from './workers/client.js';
import { readBytes } from './workers/assets.js';

const importer = new Workers();

export function cancelImport() { importer.cancel('Import replaced.'); }

async function parse(bytes, name, progress) {
  return importer.run('import', { bytes, name }, progress);
}

export async function importTable(file, progress) {
  const bytes = await readBytes(new Response(file), counts => progress({ message: 'Reading local file', ...counts, total: file.size }));
  return parse(bytes, file.name, progress);
}

export async function importExample(name, progress) {
  const response = await fetch(`/fixtures/${encodeURIComponent(name)}`);
  if (!response.ok) { throw new Error('Example is unavailable. Run npm run build to refresh fixtures.'); }
  const bytes = await readBytes(response, counts => progress({ message: 'Reading example', ...counts }));
  return parse(bytes, name, progress);
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
