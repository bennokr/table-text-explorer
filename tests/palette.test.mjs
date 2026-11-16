import assert from 'node:assert/strict';
import test from 'node:test';
import { CATEGORY, categoryColor, OTHER } from '../src/palette.js';
import { clusterGroups } from '../src/results.js';
import { categoryColors } from '../src/value-colors.js';

test('one category palette serves clusters, column values and fields, and wraps after twelve', () => {
  assert.equal(new Set(CATEGORY).size, 12);
  assert.equal(categoryColor(12), CATEGORY[0]);
  const groups = clusterGroups([0, 1, 2, -1]);
  assert.deepEqual([groups[0].color, groups[2].color, groups[-1].color], [CATEGORY[0], CATEGORY[2], OTHER]);
  const model = { rows: [{ k: 'a' }, { k: 'b' }, { k: 'a' }] };
  const colors = categoryColors(model, { name: 'k', valueLabels: [] });
  assert.deepEqual([...colors.values()], [CATEGORY[0], CATEGORY[1]]);
});
