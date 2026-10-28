import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { showMap, showClustering } from '../src/analysis-views.js';
import { mapName, clusteringName, suggestName } from '../src/analysis-names.js';
import { clusterColumns, clusterGroups } from '../src/results.js';
import { viewFieldsValid } from '../src/view-config.js';
import { legendRows } from '../src/cluster-legend-data.js';

function fixture() {
  const model = new Dataset();
  model.load({ name: 'synthetic', rows: [{ text: 'camera good' }, { text: 'battery flat' }, { text: 'camera sharp' }] });
  model.config = { ...model.config, mode: 'words', features: ['text'] };
  return model;
}

function map(model, featureSetId, name = 'my-map') {
  return model.results.add('projection', { name: `${name}-2d`, mapName: name, featureSetId });
}

function clustering(model, source) {
  const result = model.results.add('clustering', { name: 'my-clusters', ...source,
    rowIds: [0, 1, 2], labels: [0, 1, -1], groups: clusterGroups([0, 1, -1]) });
  clusterColumns(model, result);
  return result;
}

test('map creation fills empty cards and creates new cards for toolbar or populated targets', () => {
  const model = fixture();
  const empty = { id: model.nextViewId(), type: 'map' };
  model.views = [empty];
  const first = map(model, 'features-1');
  assert.equal(showMap(model, first, empty.id), empty);
  assert.equal(model.views.length, 1);
  const second = map(model, 'features-1', 'another');
  const added = showMap(model, second, empty.id);
  assert.notEqual(added, empty);
  assert.equal(model.views[0], added);
  assert.equal(model.views.length, 2);
  assert.equal(empty.resultId, first.id);
  assert.equal(added.resultId, second.id);
  const newest = showMap(model, second);
  assert.equal(model.views[0], newest);
  assert.equal(model.views.length, 3);
  assert.equal(new Set(model.views.map(view => view.id)).size, 3);
});

test('feature clustering colors related maps and creates a result-backed legend', () => {
  const model = fixture();
  const one = showMap(model, map(model, 'same-input'));
  const two = showMap(model, map(model, 'same-input'));
  const unrelated = showMap(model, map(model, 'different-input'));
  unrelated.color = 'original-color';
  const result = clustering(model, { featureSetId: 'same-input', sourceId: 'features' });
  const legend = showClustering(model, result);
  assert.equal(one.color, result.columns.name);
  assert.equal(two.color, result.columns.name);
  assert.equal(unrelated.color, 'original-color');
  assert.equal(legend.type, 'legend');
  assert.equal(legend.resultId, result.id);
  assert.equal(model.resultFor(legend), result);
  assert.equal(viewFieldsValid(model, legend), true);
  const counts = legendRows(model, result);
  assert.deepEqual(counts.map(group => group.count), [1, 1, 1]);
  assert.ok(counts.some(group => group.name === 'Other'));
});

test('clustering explicit 2D coordinates colors only that map even when features are shared', () => {
  const model = fixture();
  const first = map(model, 'same');
  const second = map(model, 'same', 'other');
  const one = showMap(model, first);
  const two = showMap(model, second);
  const result = clustering(model, { inputMapId: first.id, sourceId: first.id });
  showClustering(model, result);
  assert.equal(one.color, result.columns.name);
  assert.equal(two.color, '');
});

test('suggested names track fields, method and settings, preserve custom names, and avoid collisions', () => {
  const model = fixture();
  const first = mapName(model, model.config, 'umap');
  assert.equal(first, 'text-words-nl-umap');
  map(model, 'same', first);
  assert.equal(mapName(model, model.config, 'umap'), `${first}-2`);
  assert.match(mapName(model, { ...model.config, pooling: 'tfidf', combine: 'concat' }, 'pca'), /tfidf-concat-pca$/u);
  const input = { value: '', dataset: {} };
  suggestName(input, first);
  suggestName(input, 'new-default');
  assert.equal(input.value, 'new-default');
  input.value = 'My custom name';
  suggestName(input, 'another-default');
  assert.equal(input.value, 'My custom name');
  assert.match(clusteringName(model, model.results.list('projection')[0].id,
    { method: 'minibatch', clusters: 8 }), /minibatch-k8$/u);
});
