import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { Analysis } from '../src/analysis.js';
import { resultExport } from '../src/results.js';
import { sentenceModel } from '../src/sentence-vectors.js';

test('opt-in sentence vectors feed prepared features, keep row mapping and export hidden arrays', async () => {
  const model = new Dataset();
  model.load({ name: 'sentences', rows: [{ text: 'De camera is goed' }, { text: '' }, { text: 'The camera is good' }],
    metadata: { text: { label: 'Experience', description: 'Description at fit' } } });
  model.configure({ ...model.config, mode: 'sentences', features: ['text'], combine: 'description-mean' });
  const analysis = new Analysis(model, () => {});
  const calls = [];
  const embeddings = new Float32Array(768).fill(0.1);
  analysis.workers = { run: async (kind, data) => {
    calls.push({ kind, data });
    return kind === 'sentences' ? { features: embeddings, dimensions: 384, rowIds: [0, 2], coverage: [], sentenceModel }
      : { features: [[1], [2]], dimensions: 384 };
  } };
  const result = await analysis.representation('multilingual-map');
  assert.equal(calls[0].kind, 'sentences');
  assert.equal(calls[0].data.fields[0].description, 'Description at fit');
  assert.equal(calls[1].data.mode, 'sentences');
  assert.equal(calls[1].data.rows.length, 2);
  assert.deepEqual(result.rowIds, [0, 2]);
  assert.equal(result.embeddingDimensions, 384);
  assert.equal(model.fields.length, 1);
  model.select([0]);
  model.pinned = new Set([0]);
  model.refresh();
  await analysis.prepare();
  assert.equal(calls.length, 2);
  model.fields[0].description = 'Changed description';
  await analysis.prepare();
  assert.equal(calls.length, 4);
  const exported = JSON.parse(await resultExport(model.results.get(result.representationId)).text());
  assert.equal(exported.sentenceModel.revision, sentenceModel.revision);
  assert.equal(exported.embeddings.length, 768);
  assert.equal(exported.inputFields[0].description, 'Description at fit');
});
