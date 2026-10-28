import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { clusterColumns, resultExport } from '../src/results.js';
import { initializeTree, treeRoot, branchChildren, changeTreeCut } from '../src/cluster-tree.js';
import { legendRows, clusterMembers, renameCluster, colorCluster } from '../src/cluster-legend-data.js';
import { clusterComparison } from '../src/cluster-descriptions.js';
import { Clustering } from '../src/clustering.js';

function fixture() {
  const model = new Dataset();
  model.load({ name: 'density', rows: Array.from({ length: 7 }, (_, id) => ({ original: id })) });
  const result = model.results.add('clustering', { name: 'density', parameters: { minClusterSize: 2 },
    rowIds: [4, 0, 3, 1, 2, 5], labels: [6, 6, 7, 7, -1, -1], cut: [6, 7],
    tree: { kind: 'density', children: [[0, 1], [2, 3], [4, 5, 6, 7]], linkage: [] } });
  initializeTree(result);
  clusterColumns(model, result);
  return { model, result };
}

test('density trees support nonbinary condensed roots, persistent noise, and hierarchical counts', () => {
  const { model, result } = fixture();
  assert.equal(treeRoot(result), 8);
  assert.deepEqual(branchChildren(result, 8), [6, 7]);
  assert.deepEqual(branchChildren(result, 6), []);
  assert.deepEqual(clusterMembers(model, result, '6'), [0, 4]);
  assert.deepEqual(clusterMembers(model, result, '-1'), [2, 5]);
  assert.deepEqual(legendRows(model, result).map(row => row.id), ['6', '7', '8', '-1']);
  assert.deepEqual(legendRows(model, result).map(row => row.total), [2, 2, 6, 2]);
  model.pinned = new Set([0, 2, 6]);
  model.refresh();
  model.select([0, 2]);
  assert.deepEqual(legendRows(model, result).map(row => [row.count, row.highlighted]), [[1, 1], [0, 0], [2, 2], [1, 1]]);
  assert.equal(changeTreeCut(model, result, 3), false);
  assert.deepEqual(result.labels, [6, 6, 7, 7, -1, -1]);
});

test('density branch descriptions retain noise and compare it with other visible records', async () => {
  const { model, result } = fixture();
  const groups = clusterComparison(model, result.id).groups;
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.find(group => group.id === '-1').subset, [2, 5]);
  assert.deepEqual(groups.find(group => group.id === '-1').comparison, [0, 1, 3, 4, 6]);
  assert.deepEqual(new Set(groups[0].comparison), new Set([1, 2, 3, 5]));
  renameCluster(model, result, '6', 'Keep branch name');
  colorCluster(model, result, '8', '#123456');
  assert.equal(result.groups[-1].color, '#999999');
  const exported = JSON.parse(await resultExport(result).text());
  assert.equal(exported.groups[6].name, 'Keep branch name');
  assert.equal(exported.selection.method, 'eom');
  assert.equal(exported.tree.kind, 'density');
});

async function selectionJob(run) {
  const { model, result } = fixture();
  const job = {};
  const analysis = { generation: 0, busy: value => { model.analysisBusy = value; },
    workers: { run: (kind, payload) => {
      job.payload = payload;
      return new Promise(resolve => { job.resolve = resolve; });
    } } };
  const owner = Object.assign(Object.create(Clustering.prototype), { model, analysis });
  const previous = globalThis.document;
  globalThis.document = { querySelector: () => ({ classList: { toggle() {} } }) };
  try { await run({ model, result, job, analysis, owner }); }
  finally { globalThis.document = previous; }
}

test('explicit density reselection updates the saved result without feature fitting or losing edits', async () => {
  await selectionJob(async ({ model, result, job, owner }) => {
    model.addAnnotation('manual');
    model.annotate('manual', [0], 'Keep');
    renameCluster(model, result, '6', 'Named');
    const request = { result, selection: { method: 'leaf', epsilon: 2 } };
    const pending = owner.selectDensity(request);
    assert.equal(job.payload.task, 'density_select');
    assert.equal(job.payload.features, undefined);
    assert.equal(job.payload.tree, result.tree);
    job.resolve({ labels: [6, 6, -1, -1, -1, -1], cut: [6] });
    await pending;
    assert.deepEqual(result.selection, request.selection);
    assert.equal(model.rows[0][result.columns.name], 'Named');
    assert.equal(model.rows[1][result.columns.name], 'Other');
    assert.equal(model.rows[0].manual, 'Keep');
    assert.equal(model.analysisBusy, false);
  });
});

test('cancelled density selection cannot replace the saved labels', async () => {
  await selectionJob(async ({ result, job, analysis, owner }) => {
    const pending = owner.selectDensity({ result, selection: { method: 'leaf', epsilon: 0 } });
    analysis.generation += 1;
    job.resolve({ labels: [-1, -1, -1, -1, -1, -1], cut: [] });
    await pending;
    assert.deepEqual(result.labels, [6, 6, 7, 7, -1, -1]);
    assert.equal(result.selection.method, 'eom');
  });
});
