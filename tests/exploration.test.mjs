import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { hoverData } from '../src/scatter-hover.js';
import { previewRows } from '../src/table.js';

test('data-axis hover uses original field names and category values, without row coordinates', () => {
  const model = new Dataset();
  model.load({ name: 'sample', rows: [{ group: 'Alpha', score: 3 }, { group: 'Beta', score: 4 }] });
  const [group, score] = model.fields;
  const hover = hoverData(model, { x: { field: group }, y: { field: score } });
  assert.deepEqual(hover.tooltips.map(([name]) => name), ['group', 'score']);
  assert.deepEqual(hover.data.hover_0, ['Alpha', 'Beta']);
  assert.deepEqual(hover.data.hover_1, ['3', '4']);
  assert.ok(hover.tooltips.every(([, value]) => !value.includes('@row')));
});

test('reduced-space hover follows fitted text columns after settings change', () => {
  const model = new Dataset();
  model.load({ name: 'sample', rows: [{ positive: 'Lovely staff', negative: 'Noisy room' }] });
  const coordinates = { fitted: true, config: { ...model.config, mode: 'words', features: ['negative'] } };
  model.config.features = ['positive'];
  const hover = hoverData(model, coordinates);
  assert.deepEqual(hover.tooltips.map(([name]) => name), ['negative']);
  assert.deepEqual(hover.data.hover_0, ['Noisy room']);
});

test('table preview intersects filters and selection in visible sort order without changing the model', () => {
  const model = { visible: [7, 3, 9, 1], selected: new Set([1, 7, 5]) };
  assert.deepEqual(previewRows(model, true), [7, 1]);
  assert.deepEqual(previewRows(model, false), [7, 3, 9, 1]);
  model.selected.clear();
  assert.deepEqual(previewRows(model, true), model.visible);
  model.selected.add(5);
  assert.deepEqual(previewRows(model, true), []);
  assert.deepEqual(model.visible, [7, 3, 9, 1]);
});
