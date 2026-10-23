import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { readSav } from '@irbisadm/statfmt';

async function fixture(name) {
  const response = await fetch(`/fixtures/${name}`);
  if (!response.ok) { throw new Error(`Fixture unavailable: ${name}`); }
  return response;
}

function tableRoundtrips(records) {
  const enriched = records.map((row, index) => ({ ...row, annotation: index % 2 ? 'Review' : '' }));
  const csv = Papa.parse(Papa.unparse(enriched), { header: true }).data;
  const json = JSON.parse(JSON.stringify(enriched));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(enriched), 'Data');
  const binary = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const reopened = XLSX.read(binary, { type: 'array' });
  const excel = XLSX.utils.sheet_to_json(reopened.Sheets.Data, { defval: '' });
  return [csv, json, excel].every(table => table.length === enriched.length &&
    table.every((row, index) => String(row.rowNumber) === String(enriched[index].rowNumber)
      && row.annotation === enriched[index].annotation));
}

export async function checkImports() {
  const started = performance.now();
  const csv = Papa.parse(await (await fixture('uefa_players.csv')).text(),
    { header: true, skipEmptyLines: true });
  const sav = readSav(new Uint8Array(await (await fixture('survey.sav')).arrayBuffer()));
  const book = XLSX.read(await (await fixture('RMC_synthetische_data_20_rijen.xlsx')).arrayBuffer());
  const excel = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
  const result = {
    csv: { rows: csv.data.length, columns: csv.meta.fields.length, errors: csv.errors.length },
    sav: { rows: sav.rows.length, columns: sav.variables.length,
      labelled: sav.variables.filter(variable => variable.label).length,
      valueLabels: sav.variables.filter(variable => variable.valueLabels?.length).length },
    xlsx: { rows: excel.length, columns: Object.keys(excel[0]).length },
    annotatedRoundtrips: tableRoundtrips(csv.data),
    seconds: (performance.now() - started) / 1000,
  };
  const texts = excel.map(row => Object.values(row)
    .filter(value => typeof value === 'string' && value.trim()).join(' ')).filter(Boolean);
  return { result, texts };
}
