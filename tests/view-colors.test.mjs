import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { synchronizeViewColors } from '../src/view-colors.js';

function fixture() {
  const model = new Dataset();
  const first = model.results.add('clustering', { columns: { name: 'First names' } });
  const second = model.results.add('clustering', { columns: { name: 'Second names' } });
  const map = { id: 'map', type: 'map', color: 'original' };
  const left = { id: 'left', type: 'legend', resultId: first.id };
  const right = { id: 'right', type: 'legend', resultId: second.id };
  return { model, map, left, right };
}

test('adjacent map colors follow legend selection and ordering, with right-side tie preference', () => {
  const { model, map, left, right } = fixture();
  model.views = [left, map, right];
  synchronizeViewColors(model);
  assert.equal(map.color, 'Second names');
  assert.equal(map.legendId, right.id);
  right.resultId = left.resultId;
  synchronizeViewColors(model);
  assert.equal(map.color, 'First names');
  model.views = [map, { id: 'hist', type: 'histogram' }, right];
  synchronizeViewColors(model);
  assert.equal(map.legendId, undefined);
  assert.equal(map.color, 'First names');
  model.views = [left, map];
  synchronizeViewColors(model);
  assert.equal(map.legendId, left.id);
});
