import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { Analysis } from '../src/analysis.js';
import { Projection } from '../src/projection.js';

const output = { rowIds: [0, 1], coordinates: [[1, 2], [3, 4]], coverage: [], dimensions: 2 };

function modelForFit() {
  const model = new Dataset();
  model.load({ name: 'synthetic', rows: [{ text: 'camera good', score: 1 }, { text: 'battery flat', score: 4 }] });
  return model;
}

async function pendingMap(run) {
  const model = modelForFit();
  const job = { requests: 0 };
  const analysis = { busy: value => { model.analysisBusy = value; }, cancel() {},
    project: () => { job.requests += 1; return new Promise(done => { job.resolve = done; }); } };
  const projection = new Projection(model, analysis);
  const previous = globalThis.document;
  globalThis.document = { querySelector: () => ({ classList: { toggle() {} } }) };
  try { await run(model, projection, job); }
  finally { globalThis.document = previous; }
}

test('named representations reuse cached arrays without renaming older results', async () => {
  const model = modelForFit();
  model.configure({ ...model.config, mode: 'words', features: ['text'] });
  const analysis = new Analysis(model, () => {});
  let requests = 0;
  const embeddings = new Float32Array([1, 0, 0, 1]);
  analysis.workers = { cancel() {}, run: async kind => {
    requests += 1;
    return kind === 'words' ? { features: embeddings, dimensions: 2, rowIds: [0, 1], coverage: [] }
      : { features: [[0.1], [0.2]], dimensions: 2 };
  } };
  const first = await analysis.representation('first-map');
  analysis.cancel();
  const second = await analysis.representation('second-map');
  assert.equal(requests, 4);
  assert.notEqual(first.representationId, second.representationId);
  const saved = model.results.get(first.representationId);
  assert.equal(saved.name, 'first-map-embeddings');
  assert.equal(saved.embeddings, embeddings);
  assert.deepEqual(saved.features, [[0.1], [0.2]]);
  assert.equal(saved.embeddingDimensions, 2);
  assert.equal(second.featureSetId, first.featureSetId);
  assert.equal(await analysis.representation('clustering', true), analysis.cache.result);
});

test('finishing after card removal adds a map; cancellation cannot commit later results', async () => {
  await pendingMap(async (model, projection, job) => {
    const view = { id: 'test', type: 'map' };
    const request = { name: 'test-map', method: 'pca', targetViewId: view.id };
    model.views = [view];
    const pending = projection.fit(request);
    model.views = [];
    job.resolve(output);
    await pending;
    const saved = model.results.list('projection');
    assert.equal(saved[0].name, 'test-map-2d');
    assert.deepEqual(saved[0].x.values, [1, 3]);
    assert.equal(model.views[0].type, 'map');
    assert.equal(model.views[0].resultId, saved[0].id);
    assert.equal(view.resultId, undefined);
    const next = projection.fit(request);
    projection.cancel();
    job.resolve(output);
    await next;
    assert.equal(model.results.list('projection').length, 1);
    assert.equal(model.views.length, 1);
    assert.equal(model.analysisBusy, false);
  });
});

test('card edits during a map fit survive completion and competing fits stay blocked', async () => {
  await pendingMap(async (model, projection, job) => {
    const fitting = { id: 'fitting', type: 'map' };
    const other = { id: 'other', type: 'scatter', x: 'score', color: '' };
    model.views = [fitting, other];
    const request = { name: 'camera-umap', method: 'umap', targetViewId: fitting.id };
    const pending = projection.fit(request);
    assert.equal(model.fittingViewId, fitting.id);
    Object.assign(other, { type: 'bar', x: 'text', title: 'Edited while fitting' });
    fitting.type = 'histogram';
    model.views.push({ id: 'new', type: 'scatter' });
    await projection.fit(request);
    assert.equal(job.requests, 1);
    job.resolve(output);
    await pending;
    assert.equal(fitting.resultId, undefined);
    assert.equal(fitting.type, 'histogram');
    assert.equal(other.title, 'Edited while fitting');
    assert.equal(model.views.length, 4);
    assert.equal(model.results.list('projection')[0].method, 'umap');
    assert.equal(model.fitProgress.message, 'camera-umap saved in Exports.');
    assert.equal(model.fittingViewId, null);
    assert.equal(model.analysisBusy, false);
  });
});

test('map progress is scoped to its card and ignores unrelated analysis jobs', () => {
  const model = modelForFit();
  const updates = [];
  const analysis = new Analysis(model, update => updates.push(update));
  model.fittingViewId = 'map-card';
  analysis.progress({ message: 'Fitting UMAP', completed: 30, total: 100 });
  assert.deepEqual(model.fitProgress, { viewId: 'map-card', message: 'Fitting UMAP', completed: 30, total: 100 });
  model.fittingViewId = null;
  analysis.progress('Computing n-gram descriptions');
  assert.equal(model.fitProgress.message, 'Fitting UMAP');
  assert.equal(updates.length, 2);
  model.fittingViewId = 'next-card';
  analysis.progress('Loading local Python runtime…');
  assert.deepEqual(model.fitProgress, { viewId: 'next-card', message: 'Loading local Python runtime…' });
  model.load({ name: 'next dataset', rows: [] });
  assert.equal(model.fitProgress, null);
});

test('feature cache hits avoid reading text and ignore filtering, selection and map settings', async () => {
  const model = modelForFit();
  model.configure({ ...model.config, mode: 'text', features: ['text'] });
  const analysis = new Analysis(model, () => {});
  let requests = 0;
  analysis.workers = { run: async () => { requests += 1; return { features: [[1], [2]], dimensions: 1 }; } };
  const first = await analysis.prepare();
  assert.ok(!analysis.cache.key.includes('camera good'));
  let reads = 0;
  Object.defineProperty(model.rows[0], 'text', { enumerable: true, get: () => { reads += 1; return 'camera good'; } });
  model.select([0]);
  model.pinned = new Set([0]);
  model.refresh();
  model.configure({ ...model.config, neighbors: 3, epochs: 50 });
  assert.equal(await analysis.prepare(), first);
  assert.equal(requests, 2);
  assert.equal(reads, 0);
  model.load({ name: 'replacement', rows: [] });
  assert.equal(analysis.cache, null);
});

test('feature cache tracks selected annotations, feature settings and column type revisions', async () => {
  const model = modelForFit();
  model.addAnnotation('labels', new Map([[0, 'Keep'], [1, 'Drop']]));
  model.configure({ ...model.config, mode: 'table', features: ['score'] });
  const analysis = new Analysis(model, () => {});
  let requests = 0;
  analysis.workers = { run: async () => { requests += 1; return { features: [[1], [2]], dimensions: 1 }; } };
  const original = await analysis.prepare();
  model.annotate('labels', [0], 'Other');
  assert.equal(await analysis.prepare(), original);
  model.configure({ ...model.config, features: ['labels'] });
  await analysis.prepare();
  model.annotate('labels', [0], 'Keep');
  await analysis.prepare();
  model.configure({ ...model.config, categoryLimit: 5 });
  await analysis.prepare();
  assert.equal(requests, 4);
});
