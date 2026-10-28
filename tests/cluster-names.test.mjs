import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { nameClusters } from '../src/cluster-names.js';
import { clusterGroups } from '../src/results.js';
import { initializeTree } from '../src/cluster-tree.js';

function fixture() {
  const model = new Dataset();
  model.load({ name: 'names', rows: [0, 1, 2, 3].map(id => ({ text: id < 2 ? 'camera sharp' : 'battery lasts' })) });
  const result = { rowIds: [0, 1, 2, 3], labels: [0, 0, 1, 1], config: { ...model.config, mode: 'text', features: ['text'] },
    groups: clusterGroups([0, 0, 1, 1]) };
  return { model, result };
}

test('phrase naming sends all-record populations and keeps edited names and the highlight independent', async () => {
  const { model, result } = fixture();
  result.groups[0] = { name: 'Camera', nameEdited: true, color: '#123456' };
  model.pinned = new Set([0]);
  model.refresh();
  model.select([0]);
  let request;
  let settings;
  const analysis = { textIndexes: { ensure: async data => { settings = data; return { indexId: 'shared' }; } }, progress() {}, workers: { run: async (_, data) => {
    request = data;
    return { labels: { '1': { phrase: 'battery', kind: 'phrase', field: 'text', support: 2 } } };
  } } };
  await nameClusters(model, analysis, result);
  assert.deepEqual(request.groups[1].subset, [2, 3]);
  assert.deepEqual(request.groups[1].comparison, [0, 1]);
  assert.equal(request.groups[0].locked, true);
  assert.equal(request.indexId, 'shared');
  assert.deepEqual(settings.sizes, [1, 3]);
  assert.deepEqual(request.maxPhrases, 4);
  assert.equal(request.columns, undefined);
  assert.equal(result.groups[0].name, 'Camera');
  assert.equal(result.groups[1].name, 'battery');
  assert.equal(result.groups[1].nameEvidence.field, 'text');
  assert.deepEqual([...model.selected], [0]);
});

test('tree naming reserves phrases belonging to siblings outside the active cut', async () => {
  const { model, result } = fixture();
  result.parameters = { clusters: 3 };
  result.tree = { children: [[0, 1], [2, 3], [4, 5]], distances: [1, 2, 9] };
  initializeTree(result);
  result.groups[5].name = 'camera';
  let request;
  const analysis = { textIndexes: { ensure: async () => ({ indexId: 'shared' }) }, progress() {}, workers: { run: async (_, data) => { request = data; return { labels: {} }; } } };
  await nameClusters(model, analysis, result);
  const children = request.groups.filter(group => ['2', '3'].includes(group.id));
  assert.equal(children.length, 2);
  assert.ok(request.groups.some(group => group.blocked.includes('camera')));
  assert.equal(result.groups[5].name, 'camera');
});


test('phrase naming uses global n-grams and a separate saved phrase-count range', async () => {
  const { model, result } = fixture();
  result.maxNamePhrases = 5;
  let settings;
  const analysis = { textIndexes: { ensure: async data => { settings = data; return { indexId: 'longer' }; } },
    progress() {}, workers: { run: async () => ({ labels: {} }) } };
  await nameClusters(model, analysis, result);
  assert.deepEqual(settings.sizes, [1, 3]);
  assert.deepEqual(result.labels, [0, 0, 1, 1]);
});
