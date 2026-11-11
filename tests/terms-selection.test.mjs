import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { Terms } from '../src/terms.js';
import { TermJobs } from '../src/term-jobs.js';
import { setTermSettings } from '../src/term-settings-model.js';

function fixture(run) {
  const model = new Dataset();
  model.load({ name: 'scrub', rows: [{ text: 'camera' }, { text: 'battery' }, { text: 'camera sharp' }] });
  const result = model.results.add('clustering', { rowIds: [0, 1, 2], labels: [0, 1, 0], tree: { kind: 'agglomerative' } });
  const descriptions = { count: 0 };
  const inspector = Object.assign(Object.create(Terms.prototype), { model, lastSelection: model.selected,
    jobs: { describe: () => { descriptions.count += 1; } } });
  model.on('selection', () => inspector.selectionChanged());
  model.on('term-settings', () => inspector.jobs.describe());
  run({ model, result, inspector, descriptions });
}

test('scrubbing resumes live subset descriptions after a clustering or branch description', () => {
  fixture(({ model, result, descriptions }) => {
    model.select([0]);
    assert.equal(model.termSettings.compare, 'auto');
    assert.equal(descriptions.count, 1);
    model.select([1, 2]);
    assert.equal(descriptions.count, 2);
    setTermSettings(model, { compare: `tree:${result.id}` });
    assert.equal(descriptions.count, 3);
    model.select([]);
    assert.equal(model.termSettings.compare, 'auto', 'brushing leaves the branch description');
    assert.equal(descriptions.count, 4);
    assert.deepEqual(result.labels, [0, 1, 0]);
  });
});

test('record navigation preserves a branch description and an explicit filtered population stays chosen', () => {
  fixture(({ model, result, descriptions }) => {
    model.select([0, 2]);
    setTermSettings(model, { compare: `tree:${result.id}` });
    const before = descriptions.count;
    model.select([2, 0], 2);
    assert.equal(model.termSettings.compare, `tree:${result.id}`);
    assert.equal(descriptions.count, before);
    setTermSettings(model, { compare: 'population:filtered' });
    model.select([1]);
    assert.equal(model.termSettings.compare, 'population:filtered');
  });
});

test('changing phrase settings during a build releases busy state and discards obsolete results', async () => {
  let finish;
  const model = { revision: 1, analysisBusy: false };
  const analysis = { busy: value => { model.analysisBusy = value; },
    textIndexes: { ensure: () => new Promise(resolve => { finish = resolve; }) } };
  const jobs = Object.assign(Object.create(TermJobs.prototype), { model, analysis,
    workers: { epoch: 1 }, facets: { accept() {} }, version: 0, intent: null,
    view: { message() {} }, finish: () => assert.fail('Obsolete phrase settings must not render') });
  const running = jobs.execute({ type: 'build', payload: {} });
  assert.equal(model.analysisBusy, true);
  jobs.version += 1;
  finish({ indexId: 'old-settings' });
  await running;
  assert.equal(model.analysisBusy, false);
  assert.equal(jobs.running, false);
});
