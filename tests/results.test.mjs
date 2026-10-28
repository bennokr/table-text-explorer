import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { clusterColumns, clusterGroups, resultExport } from '../src/results.js';
import { featureFields } from '../src/features.js';
import { parseQuery } from '../src/query.js';
import { clusterComparison } from '../src/cluster-descriptions.js';

function fixture() {
  const model = new Dataset();
  model.load({ name: 'local', rows: [{ text: 'one', x: 1 }, { text: 'two', x: 2 }, { text: '', x: 3 }] });
  const result = model.results.add('clustering', { method: 'hdbscan', rowIds: [0, 2], labels: [0, -1],
    groups: clusterGroups([0, -1]) });
  clusterColumns(model, result);
  return { model, result };
}

test('memberships survive renames, filters, settings, annotations and removal of cards', () => {
  const { model, result } = fixture();
  const projection = model.results.add('projection', { method: 'pca', rowIds: [0, 2] });
  model.views = [{ id: 'a', resultId: projection.id }];
  assert.equal(model.resultFor(model.views[0]), projection);
  model.views = [];
  result.groups[0].name = 'Interesting';
  model.resultsChanged();
  model.configure({ ...model.config, categoryLimit: 2 });
  assert.equal(result.columns.id, undefined);
  assert.equal(model.fields.filter(field => field.derived === result.id).length, 1);
  assert.equal(model.rows[0][result.columns.name], 'Interesting');
  assert.ok(model.fields.find(field => field.name === result.columns.name).unique.includes('Interesting'));
  assert.equal(model.rows[1][result.columns.name], null);
  assert.equal(model.rows[2][result.columns.name], 'Other');
  assert.equal(model.results.get(projection.id), projection);
  assert.deepEqual(result.labels, [0, -1]);
  assert.equal(featureFields(model).some(field => field.derived), false);
  model.addAnnotation('manual');
  model.annotate('manual', [0], 'Keep');
  assert.throws(() => model.annotate(result.columns.name, [0], 'Overwrite'));
  const query = parseQuery(`"${result.columns.name}":Interesting`, model.fields);
  model.query = query.test;
  model.refresh();
  assert.deepEqual(model.visible, [0]);
  assert.equal(model.rows[0].text, 'one');
  model.load({ name: 'next', rows: [{ x: 7 }] });
  assert.equal(model.results.list().length, 0);
});

test('new fits avoid column collisions and preserve edited group dictionaries', async () => {
  const { model, result } = fixture();
  result.groups[0].name = 'Keep this';
  const next = model.results.add('clustering', { method: 'hdbscan', rowIds: [1], labels: [0], groups: clusterGroups([0]) });
  clusterColumns(model, next);
  assert.notEqual(result.columns.name, next.columns.name);
  assert.equal(model.rows[0][result.columns.name], 'Keep this');
  assert.equal(model.rows[1][next.columns.name], '#1');
  const exported = JSON.parse(await resultExport(result).text());
  assert.deepEqual(exported.rowIds, [0, 2]);
  assert.deepEqual(exported.labels, [0, -1]);
  assert.equal(exported.groups[0].name, 'Keep this');
  assert.equal(exported.groups[-1].name, 'Other');
});

test('projection and actual embedding downloads retain row mapping without exposing fields', async () => {
  const { model } = fixture();
  const fields = model.fields.length;
  const embedding = model.results.add('representation', { rowIds: [0, 2], features: [[1], [2]],
    embeddings: new Float32Array([1, 0, 0, 1]), embeddingDimensions: 2 });
  const projection = model.results.add('projection', { representationId: embedding.id, rowIds: [0, 2],
    x: { values: [3, NaN, 7] }, y: { values: [4, NaN, 8] } });
  assert.equal(model.fields.length, fields);
  assert.deepEqual(JSON.parse(await resultExport(projection).text()).coordinates, [[3, 4], [7, 8]]);
  assert.deepEqual(JSON.parse(await resultExport(embedding).text()).embeddings, [1, 0, 0, 1]);
});

test('cluster comparisons use stable memberships and explicit visible complements', () => {
  const { model, result } = fixture();
  const before = clusterComparison(model, result.id);
  model.select([1]);
  assert.deepEqual(clusterComparison(model, result.id), before);
  assert.deepEqual(before.groups.find(group => group.id === '-1').subset, [2]);
  assert.deepEqual(before.groups.find(group => group.id === '-1').comparison, [0, 1]);
  assert.deepEqual(before.groups.find(group => group.id === '0').subset, [0]);
  model.pinned = new Set([0, 1]);
  model.refresh();
  const filtered = clusterComparison(model, result.id);
  assert.equal(filtered.groups.length, 1);
  assert.deepEqual(filtered.groups[0].comparison, [1]);
});

test('paged group descriptions retain records on other pages in each comparison', () => {
  const model = new Dataset();
  model.load({ name: 'many groups', rows: Array.from({ length: 25 }, (_, id) => ({ value: id })) });
  const ids = model.rows.map((_, id) => id);
  const result = model.results.add('clustering', { rowIds: ids, labels: ids, groups: clusterGroups(ids) });
  const page = clusterComparison(model, result.id, 1);
  assert.equal(page.groups.length, 5);
  assert.deepEqual(page.groups[0].subset, [20]);
  assert.equal(page.groups[0].comparison.length, 24);
  assert.ok(page.groups[0].comparison.includes(0));
});
