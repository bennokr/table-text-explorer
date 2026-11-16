import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inferSchema, categoryLimits, defaultLimits } from '../src/schema.js';

const { cases } = JSON.parse(await readFile(new URL('./fixtures/column-kind-cases.json', import.meta.url), 'utf8'));

function expand(values) {
  if (Array.isArray(values)) { return values; }
  return Array.from({ length: values.length }, (_, index) => values.cycle[index % values.cycle.length]);
}

for (const { name, values, kind, why, metadata, config } of cases) {
  test(`column kind: ${name}`, () => {
    const rows = expand(values).map(value => ({ column: value }));
    const [field] = inferSchema(rows, metadata ? { column: metadata } : {}, config);
    assert.equal(field.kind, kind, why);
  });
}

test('text and numeric categories have separate default limits', () => {
  assert.deepEqual(categoryLimits(), defaultLimits);
  assert.ok(defaultLimits.text > defaultLimits.number);
  assert.deepEqual(categoryLimits({ categoryLimit: 20 }), { text: 20, number: 8 });
  assert.deepEqual(categoryLimits({ numericCategoryLimit: 3 }), { text: 50, number: 3 });
});

test('long labels that repeat are categories, and unique single tokens identify records instead of being text', () => {
  const courts = ['Rechtbank Den Haag', 'Gerecht in eerste aanleg van Sint Maarten', 'Gemeenschappelijk Hof van Justitie van Aruba'];
  const rows = Array.from({ length: 60 }, (_, id) => ({ court: courts[id % 3], ecli: `ECLI:NL:RVS:2016:${id}`,
    summary: `De rechter oordeelt in zaak ${id} dat de verdachte schuldig is aan feit ${id}.` }));
  const by = Object.fromEntries(inferSchema(rows).map(field => [field.name, field]));
  assert.equal(by.court.kind, 'categorical');
  assert.equal(by.ecli.identifier, true);
  assert.equal(by.summary.kind, 'text');
  assert.equal(by.summary.identifier, false);
});

test('the default text field is long and different for every record, not a label shared by many', async () => {
  const { Dataset } = await import('../src/state.js');
  const { featureFields } = await import('../src/features.js');
  const rows = Array.from({ length: 360 }, (_, id) => ({ title: `Wijziging van de Wet zorg en gezondheid dossier nummer ${id % 60} en nog veel meer`,
    text: `rapporteren over de gevolgen voor kinderen in zaak ${id}` }));
  const model = new Dataset();
  model.load({ name: 'motions', rows });
  assert.deepEqual(featureFields({ fields: model.fields, config: { ...model.config, mode: 'text' } }).map(field => field.name), ['text']);
});
