import assert from 'node:assert/strict';
import test from 'node:test';
import { schemaMetadata } from '../src/field-metadata.js';
import { featureFields } from '../src/features.js';
import { defaultViews } from '../src/view-config.js';
import { Dataset } from '../src/state.js';

const schema = { fields: [
  { name: 'gave_birth', type: 'integer' },
  { name: 'twins', type: 'integer', 'x-linked-codebook': { applies_when: '[gave_birth] = 1' } },
  { name: 'comment', type: 'string', 'x-linked-codebook': { applies_when: '[gave_birth] = 1' } },
] };
const rows = [
  { gave_birth: 1, twins: 2, comment: 'Goede zorg tijdens de bevalling' },
  { gave_birth: 1, twins: null, comment: null },
  { gave_birth: 0, twins: null, comment: null },
];

function load(table, metadata) {
  const model = new Dataset();
  model.load({ name: 'survey', rows: table, metadata });
  return model;
}

test('a codebook with routing rules adds read-only response profile columns', () => {
  const model = load(rows, schemaMetadata(schema));
  const profile = model.rows.map(row => [row.Answered, row.Skipped, row['Not shown'], row['Text answers'], row['Has text']]);
  assert.deepEqual(profile, [[3, 0, 0, 1, 'yes'], [1, 2, 0, 0, 'no'], [1, 0, 2, 0, 'no']]);
  assert.equal(model.fields.find(field => field.name === 'Answered').kind, 'number');
  assert.equal(model.rows[0].twins, 2);
});

test('profile columns stay out of default views and analysis inputs, and survive a type change', () => {
  const model = load(rows, schemaMetadata(schema));
  model.config.mode = 'table';
  model.config.features = null;
  assert.ok(featureFields(model).every(field => !field.computed));
  assert.ok(defaultViews(model).every(view => !['Answered', 'Has text'].includes(view.x)));
  model.configure({ ...model.config, overrides: { gave_birth: 'categorical' } });
  assert.ok(model.fields.some(field => field.computed && field.name === 'Skipped'));
});

test('a table without routing rules gets no profile columns', () => {
  const model = load(rows, schemaMetadata({ fields: [{ name: 'gave_birth', type: 'integer' }] }));
  assert.ok(!model.fields.some(field => field.computed));
});
