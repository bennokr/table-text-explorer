import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { registerExampleResults, usableResults } from '../src/example-results.js';

function table(count = 6) {
  const model = new Dataset();
  model.load({ name: 'shipped', rows: Array.from({ length: count }, (_, id) => ({ text: `record ${id}` })) });
  return model;
}

const data = (records = 6) => ({
  version: 1, table: 'shipped', records, provenance: { map: 'UMAP' },
  map: { name: 'UMAP', method: 'umap', x: [0, 1, 2, 3, 4, null].slice(0, records), y: [5, 4, 3, 2, 1, null].slice(0, records) },
  clustering: { name: 'themes', method: 'kmeans', parameters: { clusters: 2 }, labels: [0, 0, 1, 1, 0, null].slice(0, records),
    groups: { 0: { name: 'Eerste thema' }, 1: { name: 'Tweede thema', color: '#123456' } } },
});

test('a shipped map and clustering become saved results with a map card, a legend card and the curated names', () => {
  const model = table();
  const note = registerExampleResults(model, data());
  assert.match(note, /precomputed UMAP map and themes clusters/);
  assert.deepEqual(model.views.slice(0, 2).map(view => view.type), ['map', 'legend'], 'the legend follows its map');
  const [map] = model.results.list('projection');
  assert.equal(map.fitted, true);
  assert.equal(map.count, 5, 'a record without a point is left out');
  assert.ok(Number.isNaN(map.x.values[5]));
  const [clustering] = model.results.list('clustering');
  assert.deepEqual(clustering.groups[0], { name: 'Eerste thema', color: clustering.groups[0].color, nameEdited: true });
  assert.equal(clustering.groups[1].color, '#123456');
  assert.equal(model.views[0].color, clustering.columns.name, 'the map is coloured by the clusters');
  assert.equal(model.rows[2][clustering.columns.name], 'Tweede thema');
  assert.equal(model.rows[5][clustering.columns.name], null);
});

test('results for another table are ignored, not half applied', () => {
  const model = table();
  assert.equal(registerExampleResults(model, data(4)), 'data axes');
  assert.equal(registerExampleResults(model, { ...data(), version: 2 }), 'data axes');
  assert.equal(registerExampleResults(model, null), 'data axes');
  assert.equal(model.results.list().length, 0);
  assert.equal(usableResults({ ...data(), map: { x: [1], y: [1] } }, 6), false);
});
