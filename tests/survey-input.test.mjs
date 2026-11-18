import assert from 'node:assert/strict';
import test from 'node:test';
import { schemaMetadata } from '../src/field-metadata.js';
import { surveyRequest } from '../src/survey-input.js';
import { Dataset } from '../src/state.js';

const scale = level => ({ name: 'agree', type: 'integer', 'x-linked-codebook': { level,
  values: [{ code: '1', label: 'disagree' }, { code: '2', label: 'neutral' }, { code: '3', label: 'agree' }] } });

function request(level, answers) {
  const model = new Dataset();
  model.load({ name: 'survey', rows: answers.map(agree => ({ agree })), metadata: schemaMetadata({ fields: [scale(level)] }) });
  model.configure({ ...model.config, mode: 'survey', features: ['agree'] });
  return surveyRequest(model, []).columns[0];
}

test('a codebook ordinal list is compared by position, so neighbouring answers are close', () => {
  const column = request('ordinal', [1, 3, 2, null]);
  assert.equal(column.kind, 'ordinal');
  assert.deepEqual(column.values, [0, 2, 1, null]);
  assert.deepEqual([column.low, column.high], [0, 2]);
});

test('a nominal list, or an ordinal answer that is not in the list, only matches or differs', () => {
  assert.equal(request('nominal', [1, 3, 2]).kind, 'nominal');
  assert.equal(request('ordinal', [1, 3, 7]).kind, 'nominal');
});
