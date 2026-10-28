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
  assert.deepEqual(hover.data.hover, ['<div><strong>group:</strong> Alpha</div><div><strong>score:</strong> 3</div>',
    '<div><strong>group:</strong> Beta</div><div><strong>score:</strong> 4</div>']);
  assert.ok(!hover.tooltips.includes('@row'));
});

test('reduced-space hover follows fitted text columns after settings change', () => {
  const model = new Dataset();
  model.load({ name: 'sample', rows: [{ positive: 'Lovely staff', negative: 'Noisy room' }] });
  const coordinates = { fitted: true, config: { ...model.config, mode: 'words', features: ['negative'] } };
  model.config.features = ['positive'];
  const hover = hoverData(model, coordinates);
  assert.deepEqual(hover.data.hover, ['<div><strong>negative:</strong> Noisy room</div>']);
});

test('sparse hover omits missing fields per record, keeps zero/false, and escapes field names and values', () => {
  const model = new Dataset();
  model.load({ name: 'sparse', rows: [
    { empty: null, placeholder: '\\N', sentinel: 'skip', zero: 0, active: false, '<field>': '<img src=x onerror=alert(1)>' },
    { empty: 'First text', placeholder: 'Second text', sentinel: 'Third text', zero: 1, active: true, '<field>': null },
  ] });
  model.fields.find(field => field.name === 'sentinel').missingValues = ['skip'];
  const hover = hoverData(model, { fitted: true, config: { ...model.config, mode: 'table' } });
  assert.equal(hover.data.hover[0], '<div><strong>&lt;field&gt;:</strong> &lt;img src=x onerror=alert(1)&gt;</div>');
  assert.equal(hover.data.hover[1], '<div><strong>empty:</strong> First text</div><div><strong>placeholder:</strong> Second text</div><div><strong>sentinel:</strong> Third text</div>');
  const axes = hoverData(model, { x: { field: model.fields.find(field => field.name === 'zero') }, y: { field: model.fields.find(field => field.name === 'active') } });
  assert.match(axes.data.hover[0], /zero:<\/strong> 0/);
  assert.match(axes.data.hover[0], /active:<\/strong> false/);
  assert.equal(model.rows[0].sentinel, 'skip');
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
