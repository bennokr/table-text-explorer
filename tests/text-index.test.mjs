import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { TextIndexes } from '../src/text-index.js';

const settings = { fields: ['text'], sizes: [1, 3], stopwords: ['the', 'a'] };

function fixture(run) {
  const model = new Dataset();
  model.load({ name: 'index', rows: [{ text: 'camera' }, { text: 'battery' }] });
  return { model, indexes: new TextIndexes(model, run) };
}

test('shared index compatibility canonicalizes settings and fits all records once', async () => {
  const requests = [];
  const { model, indexes } = fixture(async data => { requests.push(data); return { fields: [{ name: 'text' }] }; });
  model.select([0]);
  const first = await indexes.ensure(settings);
  assert.equal(await indexes.ensure({ ...settings, stopwords: ['a', 'the', 'a'] }), first);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].columns[0].texts, ['camera', 'battery']);
  assert.equal(first.columns, undefined);
  assert.equal(indexes.get({ ...settings, sizes: [1, 1] }), undefined);
});

test('bounded variants protect the inspector index and reset rejects stale builds', async () => {
  let finish;
  const { model, indexes } = fixture(async () => ({}));
  indexes.activeId = (await indexes.ensure(settings)).indexId;
  for (let size = 1; size <= 5; size += 1) { await indexes.ensure({ ...settings, sizes: [size, size] }); }
  assert.equal(indexes.entries.size, 4);
  assert.ok(indexes.get(settings));
  indexes.run = () => new Promise(resolve => { finish = resolve; });
  const pending = indexes.ensure({ ...settings, sizes: [6, 6] });
  model.load({ name: 'new', rows: [{ text: 'new data' }] });
  finish({});
  await assert.rejects(pending, /cancelled/);
  assert.equal(indexes.entries.size, 0);
  assert.equal(indexes.activeId, null);
});


test('named configurations preserve settings through cache eviction/reset and clear with the dataset', async () => {
  const { model, indexes } = fixture(async () => ({}));
  const source = { ...settings, language: 'en', additionalStopwords: 'camera' };
  const first = indexes.saveConfiguration('Reviews', source);
  const second = indexes.saveConfiguration('Reviews', { ...source, sizes: [1, 1] });
  source.fields.push('changed');
  assert.deepEqual(first.settings.fields, ['text']);
  assert.equal(second.name, 'Reviews 2');
  await indexes.ensure(first.settings);
  for (let size = 1; size <= 5; size += 1) { await indexes.ensure({ ...settings, sizes: [size, size] }); }
  assert.equal(indexes.get(first.settings), undefined);
  assert.equal(indexes.configurations.get(first.id), first);
  indexes.clear();
  assert.equal(indexes.configurations.size, 2);
  assert.equal(indexes.entries.size, 0);
  await indexes.ensure(first.settings);
  assert.ok(indexes.get(first.settings));
  model.load({ name: 'replacement', rows: [{ text: 'replacement' }] });
  assert.equal(indexes.configurations.size, 0);
});
