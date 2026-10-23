import assert from 'node:assert/strict';
import test from 'node:test';
import { tokens, normalize, poolWords, inverseFrequency, combineFields } from '../src/word-vectors.js';

const close = (actual, expected) => actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-6));

test('Unicode words, optional stopwords and missing placeholders', () => {
  assert.deepEqual(tokens('De café-medewerkers helpen!', new Set(['de'])), ['café', 'medewerkers', 'helpen']);
  for (const empty of [null, undefined, '\\N', '']) { assert.deepEqual(tokens(empty), []); }
});

test('word means skip unknown words and report recognized token coverage', () => {
  const model = { words: { goed: 0, slecht: 1 }, dimensions: 2, values: [2, 0, 0, 2] };
  const result = poolWords(['Goed', 'slecht', 'unknown', 'constructor'], model);
  close(result.vector, [1, 1]);
  assert.equal(result.matched, 2);
  close(poolWords(['unknown'], model).vector, [0, 0]);
});

test('averaging loses field identity while vector concatenation preserves it', () => {
  const a = new Float32Array([1, 0]), b = new Float32Array([0, 1]);
  close(combineFields([a, b], [1, 1], 'mean'), combineFields([b, a], [1, 1], 'mean'));
  assert.notDeepEqual(combineFields([a, b], [1, 1], 'concat'), combineFields([b, a], [1, 1], 'concat'));
  close(combineFields([a, b], [4, 1], 'concat'), normalize(new Float32Array([2, 0, 0, 1])));
  close(combineFields([a, b], [1, 0], 'mean'), a);
  close(combineFields([a, b], [0, 0], 'mean'), [0, 0]);
});

test('missing fields do not dilute the direction of the available field', () => {
  close(combineFields([new Float32Array([0, 0]), new Float32Array([1, 0])], [1, 1], 'mean'), [1, 0]);
  const idf = inverseFrequency([['common', 'rare'], ['common', 'common']]);
  assert.ok(idf.get('rare') > idf.get('common'));
});
