import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonSets } from '../src/term-view.js';
import { stopwordList } from '../src/features.js';

test('subset descriptions use disjoint comparisons and intersect selections with visible records', () => {
  const model = { rows: Array(6).fill({}), visible: [4, 1, 3], selected: new Set([0, 1, 4]) };
  assert.deepEqual(comparisonSets(model, 'selection'), { subset: [4, 1], comparison: [3] });
  assert.deepEqual(comparisonSets(model, 'filtered'), { subset: [4, 1, 3], comparison: [0, 2, 5] });
  assert.deepEqual([...model.selected], [0, 1, 4]);
});

test('inspector retains built-in negations but respects explicit additional stopwords', () => {
  assert.ok(!stopwordList({ language: 'nl', stopwords: '' }, true).includes('niet'));
  assert.ok(stopwordList({ language: 'nl', stopwords: 'NIET,prima' }, true).includes('niet'));
  assert.ok(stopwordList({ language: 'nl', stopwords: '' }).includes('niet'));
});
