import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { npyBlob } from '../src/embedding-files.js';
import { fetchExampleEmbeddings, registerExampleEmbeddings } from '../src/example-embeddings.js';
import { demoSettings } from '../src/demo-settings.js';

const vectors = async () => await npyBlob(new Float32Array([1, 0, 0, 1, 1, 1]), 3, 2).arrayBuffer();

async function withFetch(files, run) {
  const original = globalThis.fetch;
  globalThis.fetch = async url => {
    const name = String(url).split('/').at(-1);
    return files[name] ? { ok: true, arrayBuffer: async () => files[name] } : { ok: false };
  };
  try { return await run(); } finally { globalThis.fetch = original; }
}

test('an example loads the embeddings it ships with, skipping files that are missing or do not fit', async () => {
  const list = [{ file: 'good.npy', field: 'text', model: 'dutch', default: true }, { file: 'missing.npy', field: 'other' },
    { file: 'short.npy', field: 'wrong' }];
  const short = await npyBlob(new Float32Array([1, 2]), 1, 2).arrayBuffer();
  const loaded = await withFetch({ 'good.npy': await vectors(), 'short.npy': short }, () => fetchExampleEmbeddings(list, 3, () => {}));
  assert.deepEqual(loaded.map(item => item.field), ['text']);
  assert.equal(loaded[0].dimensions, 2);
});

test('registered embeddings are offered to the map form and make the demo start from them', () => {
  const model = new Dataset();
  model.load({ name: 'demo', rows: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] });
  const preferred = registerExampleEmbeddings(model, [
    { field: 'summary', model: 'dutch', features: new Float32Array(2), dimensions: 2, rowIds: [0] },
    { field: 'text', model: 'dutch', default: true, features: new Float32Array(2), dimensions: 2, rowIds: [0] }]);
  assert.equal(model.importedEmbeddings.size, 2);
  assert.equal(preferred.field, 'text');
  demoSettings(model, { analysis: { mode: 'text', language: 'nl' } }, preferred);
  assert.equal(model.config.mode, 'sentences');
  assert.deepEqual(model.config.features, ['text']);
  assert.equal(model.config.sentenceModel, preferred.key);
  assert.equal(registerExampleEmbeddings(model, []), null);
});
