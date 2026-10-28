import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { axisCoordinates, defaultViews, changeViewType } from '../src/view-config.js';
import { combineSelection } from '../src/selection.js';
import { packRows, fittedWidths, fittedHeight, snappedHeight } from '../src/view-layout-math.js';

test('view configurations keep independent fits through filters, annotations and schema edits', () => {
  const model = new Dataset();
  model.load({ name: 'views', rows: [{ x: 2, y: 7 }, { x: 5, y: 8 }] });
  const first = model.results.add('projection', { x: [1, 2] });
  const second = model.results.add('projection', { x: [8, 9] });
  const left = { id: 'left', type: 'map', resultId: first.id };
  const right = { id: 'right', type: 'map', resultId: second.id };
  model.views = [left, right];
  model.addAnnotation('labels');
  model.annotate('labels', [0], 'Keep');
  model.pinned = new Set([0]);
  model.refresh();
  model.configure({ ...model.config, categoryLimit: 4 });
  model.views.reverse();
  assert.equal(model.views[0], right);
  assert.deepEqual(model.resultFor(left).x, [1, 2]);
  assert.deepEqual(model.resultFor(right).x, [8, 9]);
  assert.deepEqual(axisCoordinates(model, { x: 'x', y: '' }).y.values, [1, 2]);
  assert.equal(defaultViews(model)[0].type, 'scatter');
  model.load({ name: 'next', rows: [] });
  assert.deepEqual(model.views, []);
});

test('aggregate brush modifiers combine record membership without expanding partial bins', () => {
  const previous = new Set([1, 2, 8]);
  assert.deepEqual(combineSelection(previous, [2, 3], 'replace'), [2, 3]);
  assert.deepEqual(combineSelection(previous, [2, 3], 'add'), [1, 2, 8, 3]);
  assert.deepEqual(combineSelection(previous, [2, 3], 'intersect'), [2]);
  assert.deepEqual(combineSelection(previous, [2, 3], 'subtract'), [1, 8]);
  assert.deepEqual([...previous], [1, 2, 8]);
});

test('inline chart type changes choose compatible columns and preserve pending fit results', () => {
  const model = new Dataset();
  model.load({ name: 'types', rows: [{ score: 2, group: 'A' }, { score: 5, group: 'B' }] });
  model.configure({ ...model.config, overrides: { score: 'number', group: 'categorical' } });
  const saved = model.results.add('projection', { method: 'pca' });
  const view = { type: 'map', x: '', y: '', resultId: saved.id };
  assert.deepEqual(changeViewType(model, view, 'bar'), { type: 'bar', x: 'group', y: '' });
  assert.deepEqual(changeViewType(model, view, 'histogram'), { type: 'histogram', x: 'score', y: '' });
  assert.deepEqual(changeViewType(model, view, 'map'), { type: 'map', x: '', y: '', resultId: saved.id });
  assert.equal(model.resultFor(view).method, 'pca');
});

test('cards wrap at their minimum widths and fill rows without violating minimum widths', () => {
  const cards = ['a', 'b', 'c'].map(id => ({ id }));
  const widths = new Map();
  assert.deepEqual(packRows(cards, 600, new Set()).map(row => row.length), [2, 1]);
  assert.deepEqual(packRows(cards, 400, new Set()).map(row => row.length), [1, 1, 1]);
  assert.deepEqual(fittedWidths(cards.slice(0, 2), 600, widths), [297, 297]);
  widths.set('a', 310);
  widths.set('b', 284);
  assert.deepEqual(packRows(cards, 600, new Set()).map(row => row.length), [2, 1]);
  assert.deepEqual(fittedWidths(cards.slice(0, 2), 600, widths), [310, 284]);
  assert.deepEqual(packRows(cards, 1000, new Set(['b'])).map(row => row.length), [1, 2]);
  assert.deepEqual(fittedWidths(cards.slice(0, 1), 150, widths), [150]);
});

test('row heights fit initially, preserve chart minimums and snap back to fitted height', () => {
  assert.equal(fittedHeight(406, 2), 200);
  assert.equal(fittedHeight(250, 2), 180);
  assert.equal(snappedHeight(211, 200), 200);
  assert.equal(snappedHeight(230, 200), 230);
  assert.equal(snappedHeight(100, 200), 180);
});
