import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { clusterColumns, clusterGroups, resultExport } from '../src/results.js';
import { legendRows, renameCluster, colorCluster } from '../src/cluster-legend-data.js';
import { changeViewType, viewFieldsValid } from '../src/view-config.js';

function fixture() {
  const model = new Dataset();
  model.load({ name: 'legend', rows: Array.from({ length: 5 }, (_, id) => ({ original: id })) });
  const result = model.results.add('clustering', { name: 'topics', rowIds: [0, 1, 2, 3],
    labels: [0, 0, 1, -1], groups: clusterGroups([0, 0, 1, -1]) });
  clusterColumns(model, result);
  return { model, result };
}

test('legend counts keep noise and zero-visible groups and follow filters/highlights', () => {
  const { model, result } = fixture();
  const all = legendRows(model, result);
  assert.deepEqual(all.map(group => group.total), [2, 1, 1]);
  assert.deepEqual(all.map(group => group.width), [100, 50, 50]);
  model.pinned = new Set([1, 3, 4]);
  model.refresh();
  model.select([0, 1, 2]);
  const filtered = legendRows(model, result);
  assert.deepEqual(filtered.map(group => group.ids), [[1], [], [3]]);
  assert.deepEqual(filtered.map(group => group.count), [1, 0, 1]);
  assert.deepEqual(filtered.map(group => group.highlighted), [1, 0, 0]);
  assert.ok(filtered.every(group => Number.isFinite(group.width)));
  assert.deepEqual(result.labels, [0, 0, 1, -1]);
});

test('legend edits update derived names and exports without changing IDs or annotations', async () => {
  const { model, result } = fixture();
  model.addAnnotation('manual');
  model.annotate('manual', [0], 'Keep');
  assert.equal(renameCluster(model, result, '0', ' Camera '), 'Camera');
  renameCluster(model, result, '1', 'Camera');
  colorCluster(model, result, '0', '#123456');
  assert.equal(legendRows(model, result).length, 3);
  assert.equal(model.rows[0][result.columns.name], 'Camera');
  assert.equal(model.rows[2][result.columns.name], 'Camera');
  assert.deepEqual(result.labels, [0, 0, 1, -1]);
  assert.equal(model.rows[0].manual, 'Keep');
  const exported = JSON.parse(await resultExport(result).text());
  assert.equal(exported.groups[0].name, 'Camera');
  assert.equal(exported.groups[0].color, '#123456');
  assert.equal(renameCluster(model, result, '-1', ' '), 'Other');
});

test('Legend cards select clustering results and do not treat them as maps', () => {
  const { model, result } = fixture();
  const view = { type: 'scatter', x: 'original', y: '' };
  const legend = changeViewType(model, view, 'legend');
  assert.equal(legend.resultId, result.id);
  assert.equal(viewFieldsValid(model, legend), true);
  assert.equal(viewFieldsValid(model, { type: 'map', resultId: result.id }), false);
  assert.equal(changeViewType(model, legend, 'map').resultId, '');
  assert.equal(viewFieldsValid(model, { type: 'legend', resultId: '' }), false);
});
