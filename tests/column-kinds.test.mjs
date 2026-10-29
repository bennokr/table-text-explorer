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
