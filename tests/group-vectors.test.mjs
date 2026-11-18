import assert from 'node:assert/strict';
import test from 'node:test';
import { combineSentenceFields, sentenceModel } from '../src/sentence-vectors.js';
import { SentenceEncoder } from '../src/sentence-encoder.js';
import { groupName } from '../src/group-vectors.js';
import { Dataset } from '../src/state.js';
import { payload, featureKey } from '../src/features.js';

const model = { ...sentenceModel, dimensions: 2 };
const fields = [{ name: 'a', group: 'A' }, { name: 'b', group: 'A' }, { name: 'c', group: 'B' }];
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

test('group means balance groups, preserve semantic distances and mix squared-distance contributions', () => {
  const input = { rows: [{}, {}, {}, {}], fields, weights: {}, combine: 'group-mean' };
  const results = [[1, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 0, 1, 0], [0, 0, 1, 0, 0, 0, 0, 1]]
    .map(values => ({ values: new Float32Array(values), coverage: {} }));
  const shared = combineSentenceFields({ ...input, groupIdentity: 0 }, results, model);
  assert.deepEqual(shared.rowIds, [0, 1, 3]);
  assert.equal(shared.dimensions, 2);
  close(shared.features[4], Math.SQRT1_2);
  close(shared.features[5], Math.SQRT1_2);
  for (const identity of [0.2, 0.5, 1]) {
    const result = combineSentenceFields({ ...input, groupIdentity: identity }, results, model);
    const first = result.features.slice(0, result.dimensions);
    const second = result.features.slice(result.dimensions, result.dimensions * 2);
    close(dot(first, second), 1 - identity);
    close(dot(first, first), 1);
    assert.equal(result.dimensions, identity === 1 ? 4 : 6);
    assert.deepEqual(result.aggregation.groups, [{ name: 'A', fields: ['a', 'b'] }, { name: 'B', fields: ['c'] }]);
  }
  const excluded = combineSentenceFields({ ...input, weights: { a: 0, b: 0, c: 0 } }, results, model);
  assert.deepEqual(excluded.rowIds, []);
  assert.throws(() => combineSentenceFields({ ...input, groupIdentity: 2 }, results, model), /0 and 100/);
  assert.throws(() => combineSentenceFields({ ...input, weights: { a: -1 } }, results, model), /nonnegative/);
});

test('prefixes, field groups, identity and weights are independent; compatible changes reuse inference', async () => {
  let calls = 0;
  const encoder = new SentenceEncoder(text => [...text].map(char => char.codePointAt(0)), async windows => {
    calls += 1;
    return windows.map(tokens => new Float32Array([tokens[0], 1]));
  }, undefined, model);
  const input = { revision: 1, rows: [{ a: 'yes', b: 'no', c: '' }, { a: '', b: '', c: 'yes' }], fields,
    sentence: { chunking: 'chunks', size: 16, overlap: 0 }, weights: {}, combine: 'group-mean', includeDescriptions: true };
  const first = await encoder.embed(input, () => {});
  const initial = calls;
  const changed = await encoder.embed({ ...input, fields: fields.map(field => ({ ...field, group: 'Merged' })), groupIdentity: 1 }, () => {});
  assert.equal(calls, initial);
  assert.equal(first.dimensions, 6);
  assert.equal(changed.dimensions, 2);
  assert.ok(first.coverage[0].descriptionTokensPerChunk > 0);
  await encoder.embed({ ...input, combine: 'concat', weights: { a: 2 } }, () => {});
  assert.equal(calls, initial);
  await encoder.embed({ ...input, includeDescriptions: false }, () => {});
  assert.ok(calls > initial);
});

test('metadata groups enter feature keys and exported input descriptors', () => {
  const data = new Dataset();
  data.load({ name: 'groups', rows: [{ a: 'yes', b: 'no' }], metadata: { a: { group: 'Context' } } });
  data.configure({ ...data.config, mode: 'sentences', features: ['a', 'b'], combine: 'group-mean', includeDescriptions: true });
  assert.equal(groupName(data.fields[0]), 'Context');
  assert.equal(payload(data, 'prepare').fields[1].group, 'Other columns');
  const original = featureKey(data);
  assert.equal(payload(data, 'prepare').fields[0].group, 'Context');
  assert.equal(featureKey(data), original);
});
