import assert from 'node:assert/strict';
import test from 'node:test';
import { mapColumn, tintByRegion } from '../src/term-regions.js';

const rows = Array.from({ length: 40 }, (_, id) => ({ cluster: id < 20 ? 'zorg' : 'school' }));
const results = { get: id => (id === 'r1' ? { groups: { 0: { name: 'zorg', color: '#111111' }, 1: { name: 'school', color: '#222222' } } } : null) };
const model = { rows, results, views: [{ type: 'map', color: 'cluster' }],
  fields: [{ name: 'cluster', kind: 'categorical', derived: 'r1', valueLabels: [] }] };
const term = ids => ({ phrase: 'x', ids });
const result = { ranking: 'semantic', fields: [{ name: 'text', terms: [term([0, 1, 2, 3]), term([25, 26, 27, 1])] }] };

test('a semantic phrase takes the color of the cluster most of its records belong to', () => {
  const [zorg, school] = tintByRegion(model, result).fields[0].terms;
  assert.deepEqual([zorg.color, zorg.region, zorg.regionShare], ['#111111', 'zorg', 1]);
  assert.deepEqual([school.color, school.region, school.regionShare], ['#222222', 'school', 0.75]);
});

test('phrases spread over many regions are grey, and a map without a category leaves the result alone', () => {
  const many = { rows: Array.from({ length: 10 }, (_, id) => ({ cluster: `c${id}` })), results, views: model.views, fields: model.fields };
  const grey = tintByRegion(many, { fields: [{ terms: [term([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])] }] });
  assert.equal(grey.fields[0].terms[0].color, '#999999');
  assert.equal(grey.fields[0].terms[0].region, null);
  const plain = { ...model, views: [{ type: 'map', color: '' }] };
  assert.equal(mapColumn(plain), null);
  assert.equal(tintByRegion(plain, result), result);
});
