import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { clusterColumns, resultExport } from '../src/results.js';
import { initializeTree, changeTreeCut, treeMembers } from '../src/cluster-tree.js';
import { legendRows, clusterMembers, renameCluster, colorCluster } from '../src/cluster-legend-data.js';
import { clusterComparison } from '../src/cluster-descriptions.js';

function fixture() {
  const model = new Dataset();
  model.load({ name: 'tree', rows: Array.from({ length: 5 }, (_, original) => ({ original })) });
  const result = model.results.add('clustering', { name: 'branches', rowIds: [3, 0, 2, 1],
    parameters: { clusters: 2 }, tree: { children: [[0, 1], [2, 3], [4, 5]], distances: [1, 2, 9] } });
  initializeTree(result);
  clusterColumns(model, result);
  return { model, result };
}

test('tree cuts partition stable row IDs and preserve dictionary edits, source data and annotations', async () => {
  const { model, result } = fixture();
  model.addAnnotation('manual');
  model.annotate('manual', [0], 'Keep');
  assert.deepEqual(result.labels, [4, 4, 5, 5]);
  renameCluster(model, result, '4', 'Camera');
  colorCluster(model, result, '4', '#123456');
  assert.equal(model.rows[0][result.columns.name], 'Camera');
  for (const count of [1, 4, 3, 2]) {
    assert.equal(changeTreeCut(model, result, count), true);
    assert.equal(new Set(result.labels).size, count);
    assert.deepEqual(result.cut.flatMap(id => treeMembers(result, id)).sort(), [0, 1, 2, 3]);
  }
  assert.equal(result.groups[4].name, 'Camera');
  assert.equal(result.groups[4].color, '#123456');
  assert.equal(model.rows[0][result.columns.name], 'Camera');
  assert.equal(model.rows[0].manual, 'Keep');
  assert.deepEqual(model.rows.map(row => row.original), [0, 1, 2, 3, 4]);
  assert.equal(model.rows[4][result.columns.name], null);
  const output = JSON.parse(await resultExport(result).text());
  assert.deepEqual(output.tree, result.tree);
  assert.deepEqual(output.labels, [4, 4, 5, 5]);
});

test('tree counts aggregate once, branch brushing respects visibility, and invalid cuts do nothing', () => {
  const { model, result } = fixture();
  model.pinned = new Set([0, 1, 4]);
  model.refresh();
  model.select([0, 1]);
  const rows = legendRows(model, result);
  assert.deepEqual(rows.slice(4).map(row => [row.count, row.total, row.highlighted]), [[1, 2, 1], [1, 2, 1], [2, 4, 2]]);
  assert.deepEqual(clusterMembers(model, result, '4'), [0]);
  assert.equal(rows.at(-1).width, 100);
  assert.equal(result.labels[result.rowIds.indexOf(0)], 4);
  for (const invalid of [0, 5, 2.5, NaN]) { assert.equal(changeTreeCut(model, result, invalid), false); }
  assert.deepEqual(result.labels, [4, 4, 5, 5]);
});

test('tree descriptions use the active cut or chosen branch and explicit sibling/rest comparisons', () => {
  const { model, result } = fixture();
  assert.equal(clusterComparison(model, result.id).groups.length, 2);
  result.descriptionNode = 0;
  const siblings = clusterComparison(model, result.id).groups[0];
  assert.deepEqual(siblings.subset, [3]);
  assert.deepEqual(siblings.comparison, [0]);
  assert.deepEqual(clusterComparison(model, result.id, 0, 'rest').groups[0].comparison, [0, 1, 2, 4]);
  result.descriptionNode = 6;
  assert.deepEqual(clusterComparison(model, result.id).groups[0].comparison, []);
});

test('colors are deterministic hex values and deep trees do not require recursive traversal', () => {
  const { result } = fixture();
  const again = fixture().result;
  assert.deepEqual(result.groups, again.groups);
  assert.ok(Object.values(result.groups).every(group => /^#[0-9a-f]{6}$/.test(group.color)));
  assert.notEqual(result.groups[4].color, result.groups[5].color);
  const size = 5000;
  const deep = { rowIds: Array.from({ length: size }, (_, id) => id), parameters: { clusters: 8 },
    tree: { children: [[0, 1], ...Array.from({ length: size - 2 }, (_, index) => [size + index, index + 2])] } };
  initializeTree(deep);
  assert.equal(treeMembers(deep, size * 2 - 2).length, size);
  assert.equal(new Set(deep.labels).size, 8);
});

test('branch color edits cascade as shades while preserving individually edited subtrees', () => {
  const { model, result } = fixture();
  colorCluster(model, result, '4', '#123456');
  const preserved = [result.groups[4].color, result.groups[0].color, result.groups[1].color];
  colorCluster(model, result, '6', '#aabbcc');
  assert.deepEqual([result.groups[4].color, result.groups[0].color, result.groups[1].color], preserved);
  assert.equal(result.groups[6].color, '#aabbcc');
  assert.notEqual(result.groups[2].color, result.groups[3].color);
});
