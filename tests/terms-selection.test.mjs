import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { Terms } from '../src/terms.js';

function fixture(run) {
  const model = new Dataset();
  model.load({ name: 'scrub', rows: [{ text: 'camera' }, { text: 'battery' }, { text: 'camera sharp' }] });
  const result = model.results.add('clustering', { rowIds: [0, 1, 2], labels: [0, 1, 0] });
  const scope = Object.assign(new EventTarget(), { value: result.id });
  const inspector = Object.assign(Object.create(Terms.prototype), { model, lastSelection: model.selected,
    describe: () => { inspector.descriptions += 1; }, descriptions: 0 });
  scope.addEventListener('input', () => inspector.describe());
  model.on('selection', () => inspector.selectionChanged());
  const previous = globalThis.document;
  globalThis.document = { querySelector: () => scope };
  try { run({ model, result, scope, inspector }); }
  finally { globalThis.document = previous; }
}

test('scrubbing resumes live subset descriptions after a clustering or branch description', () => {
  fixture(({ model, result, scope, inspector }) => {
    model.select([0]);
    assert.equal(scope.value, 'selection');
    assert.equal(inspector.descriptions, 1);
    model.select([1, 2]);
    assert.equal(inspector.descriptions, 2);
    scope.value = result.id;
    model.select([]);
    assert.equal(scope.value, 'selection');
    assert.equal(inspector.descriptions, 3);
    assert.deepEqual(result.labels, [0, 1, 0]);
  });
});

test('record navigation preserves the clustering description and explicit filtered scope stays available', () => {
  fixture(({ model, result, scope, inspector }) => {
    model.select([0, 2]);
    scope.value = result.id;
    model.select([2, 0], 2);
    assert.equal(scope.value, result.id);
    assert.equal(inspector.descriptions, 1);
    scope.value = 'filtered';
    model.select([1]);
    assert.equal(scope.value, 'filtered');
    assert.equal(inspector.descriptions, 2);
  });
});

test('changing phrase settings during a build releases busy state and discards obsolete results', async () => {
  let finish;
  const model = { revision: 1, analysisBusy: false };
  const analysis = { busy: value => { model.analysisBusy = value; },
    textIndexes: { ensure: () => new Promise(resolve => { finish = resolve; }) } };
  const inspector = Object.assign(Object.create(Terms.prototype), { model, analysis,
    workers: { epoch: 1 }, facets: { accept() {} }, version: 0, intent: null,
    finish: () => assert.fail('Obsolete phrase settings must not render') });
  const running = inspector.execute({ type: 'build', payload: {} });
  assert.equal(model.analysisBusy, true);
  inspector.version += 1;
  finish({ indexId: 'old-settings' });
  await running;
  assert.equal(model.analysisBusy, false);
  assert.equal(inspector.running, false);
});
