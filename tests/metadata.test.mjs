import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import * as XLSX from 'xlsx';
import { fieldDescription, schemaMetadata } from '../src/field-metadata.js';
import { inferSchema, missing, numberOf } from '../src/schema.js';
import { parseTable } from '../src/table-readers.js';
import { parseQuery } from '../src/query.js';
import { Dataset } from '../src/state.js';
import { readCodebook } from '../src/codebook-profile.js';
import { demoSettings } from '../src/demo-settings.js';

const example = 'docs/examples/codebook';

test('public codebook example preserves declared types, labels and empty text columns', async () => {
  const schema = JSON.parse(await readFile(`${example}/schema.metadata.json`, 'utf8'));
  const book = XLSX.read(await readFile(`${example}/codebook.xlsx`));
  const fields = XLSX.utils.sheet_to_json(book.Sheets.Columns);
  assert.deepEqual(fields.map(field => field.name), schema.fields.map(field => field.name));
  const metadata = schemaMetadata(schema);
  assert.equal(fieldDescription(metadata.notes), 'Free-text notes about the record');
  assert.equal(fieldDescription({ name: 'notes', label: ' Notes field ' }), 'Notes field');
  assert.equal(fieldDescription({ name: 'notes' }), 'notes');
  const inferred = Object.fromEntries(inferSchema([{ record_id: '00001', score: 30,
    notes: null, status: 1, level: 5 }], metadata).map(field => [field.name, field]));
  assert.equal(inferred.record_id.identifier, true);
  assert.equal(inferred.score.kind, 'number');
  assert.equal(inferred.notes.kind, 'text');
  assert.equal(inferred.notes.empty, true);
  assert.equal(inferred.status.kind, 'categorical');
  assert.equal(inferred.level.valueLabels.find(pair => pair.value === 5).label, 'High');
});

test('schemas keep native labels and separate incomplete label dictionaries from closed categories', () => {
  const base = { status: { valueLabels: [{ value: 1, label: 'First' }], measure: 1 } };
  const metadata = schemaMetadata({ fields: [{ name: 'status', title: 'Status', 'x-linked-codebook': { level: 'nominal' } }] }, base);
  assert.deepEqual(metadata.status.valueLabels, base.status.valueLabels);
  assert.equal(metadata.status.kind, 'categorical');
});

test('structured columns are omitted as whole columns while scalar values remain intact', () => {
  const rows = [{ text: 'Review', pros: { fast: 0.9 }, cons: {}, id: 0, active: false },
    { text: null, pros: null, cons: ['slow'], id: 1, active: true }];
  const parsed = parseTable(new TextEncoder().encode(JSON.stringify(rows)), 'test.json');
  assert.deepEqual(parsed.ignoredFields, ['pros', 'cons']);
  assert.deepEqual(parsed.rows, [{ text: 'Review', id: 0, active: false }, { text: null, id: 1, active: true }]);
});

test('missing placeholders remain raw but disappear from statistics and numeric/query matching', () => {
  const rows = [{ score: '\\N' }, { score: '3' }, { score: '' }];
  const fields = inferSchema(rows);
  assert.equal(rows[0].score, '\\N');
  assert.equal(fields[0].missing, 2);
  assert.deepEqual(fields[0].unique, ['3']);
  assert.equal(missing('\\N'), true);
  assert.equal(missing(false), false);
  assert.equal(missing(0), false);
  assert.ok(Number.isNaN(numberOf('\\N', fields[0])));
  assert.deepEqual(rows.filter(parseQuery('score:null', fields).test), [rows[0], rows[2]]);
});

test('demo descriptors reference valid fields and do not leak defaults to a subsequent import', async () => {
  for (const entry of await readdir('demo-config', { withFileTypes: true })) {
    if (!entry.isDirectory()) { continue; }
    const name = entry.name;
    const directory = `demo-config/${name}`;
    const schema = JSON.parse(await readFile(`${directory}/schema.metadata.json`, 'utf8'));
    const demo = JSON.parse(await readFile(`${directory}/demo.json`, 'utf8'));
    const names = new Set(schema.fields.map(field => field.name));
    for (const field of demo.analysis.features ?? []) { assert.ok(names.has(field), `${name}: ${field}`); }
    for (const view of demo.views) {
      for (const field of [view.x, view.y].filter(Boolean)) { assert.ok(names.has(field), `${name}: ${field}`); }
    }
    const model = new Dataset();
    model.load({ name, rows: [Object.fromEntries(schema.fields.map(field => [field.name, null]))], metadata: schemaMetadata(schema) });
    demoSettings(model, demo);
    assert.equal(model.views.length, demo.views.length);
    model.load({ name: 'other', rows: [{ id: 1 }] });
    assert.equal(model.config.mode, 'table');
    assert.equal(model.config.features, null);
  }
});


test('spreadsheet profile converts back to equivalent field interpretations and category labels', async () => {
  const original = JSON.parse(await readFile(`${example}/schema.metadata.json`, 'utf8'));
  const converted = readCodebook(await readFile(`${example}/codebook.xlsx`));
  const first = schemaMetadata(original), second = schemaMetadata(converted);
  for (const name of Object.keys(first)) {
    assert.equal(second[name].kind, first[name].kind, name);
    assert.deepEqual(second[name].valueLabels, first[name].valueLabels, name);
    assert.equal(Boolean(second[name].identifier), Boolean(first[name].identifier), name);
  }
});

test('spreadsheet profile reads the public codebook into exactly the pinned Table Schema', async () => {
  // Pins every field property and linked-codebook slot the app reads (see docs/maintenance.md, "Codebook reader"); a new reader must reproduce it.
  const pinned = JSON.parse(await readFile('tests/fixtures/codebook-schema.json', 'utf8'));
  assert.deepEqual(JSON.parse(JSON.stringify(readCodebook(await readFile(`${example}/codebook.xlsx`)))), pinned);
});

test('codebooks reject missing, blank and duplicate names rather than silently losing fields', () => {
  for (const fields of [[{ title: 'No name' }], [{ name: ' ' }], [{ name: 'score' }, { name: 'score' }]]) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(fields), 'Columns');
    const bytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    assert.throws(() => readCodebook(bytes, { onWarning() {} }), /name is required|no columns found|listed twice/u);
  }
});

function workbook(sheets) {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) { XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name); }
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

test('cells whose type does not match their header are reported by sheet, row and header', () => {
  const bytes = workbook({
    Columns: [['name', 'minimum', 'identifying', 'colour'], ['a', '5', 1, 'x']],
    Values: [['column', 'code', 'label'], ['a', 7, 'Seven'], ['a', '08', 'Eight']],
  });
  const warnings = [];
  const schema = readCodebook(bytes, { onWarning: message => warnings.push(message) });
  assert.deepEqual(warnings, [
    'Columns header colour is not used',
    'Columns row 2, minimum: "5" is text but this header takes a number',
    'Columns row 2, identifying: 1 is a number; use TRUE or FALSE',
    'Values row 2, code: 7 is a number but this header takes text; write it as text so that leading zeros survive',
  ]);
  assert.equal(schema.fields[0].constraints.minimum, 5);
  assert.throws(() => readCodebook(bytes, { strict: true }), /4 warnings/u);
});

test('codebook cells that cannot be read name the sheet and row', () => {
  const bytes = workbook({ Columns: [['name', 'datatype'], ['a', 'strng']] });
  assert.throws(() => readCodebook(bytes), /Columns row 2, datatype: 'strng' is not one of/u);
});

test('Excel dates and timestamps preserve their calendar and time distinction', () => {
  const book = XLSX.utils.book_new();
  const serial = (Date.UTC(2026, 9, 28) - Date.UTC(1899, 11, 30)) / 86400000;
  const sheet = XLSX.utils.aoa_to_sheet([['day', 'timestamp'], [serial, serial + (12 * 3600 + 34 * 60 + 56) / 86400]]);
  sheet.A2.z = 'yyyy-mm-dd';
  sheet.B2.z = 'yyyy-mm-dd hh:mm:ss';
  XLSX.utils.book_append_sheet(book, sheet, 'Data');
  const parsed = parseTable(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), 'dates.xlsx');
  assert.deepEqual(inferSchema(parsed.rows).map(field => field.kind), ['date', 'datetime']);
  assert.equal(numberOf(parsed.rows[0].timestamp, { kind: 'datetime' }), Date.UTC(2026, 9, 28, 12, 34, 56));
});
