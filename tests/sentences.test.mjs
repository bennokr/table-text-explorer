import assert from 'node:assert/strict';
import test from 'node:test';
import { sentenceSettings, tokenWindows, sentenceModel, fieldCombinationOptions } from '../src/sentence-vectors.js';
import { SentenceEncoder } from '../src/sentence-encoder.js';
import { sentenceInputs } from '../src/sentence-inference.js';
import { embedRecords } from '../src/sentence-batches.js';

const settings = { chunking: 'chunks', size: 16, overlap: 4 };

function fixture(limit) {
  let calls = 0;
  const encode = new SentenceEncoder(text => [...text].map(char => char.codePointAt(0)), async batches => {
    calls += 1;
    return batches.map(ids => {
      const vector = new Float32Array(sentenceModel.dimensions);
      vector[0] = ids[0];
      vector[1] = 10;
      return vector;
    });
  }, limit);
  const payload = { revision: 1, fields: [{ name: 'positive' }, { name: 'negative' }],
    rows: [{ positive: 'camera', negative: 'battery' }, { positive: '', negative: 'flat' }, { positive: '\\N', negative: null }],
    sentence: settings, weights: {}, combine: 'mean' };
  return { encode, payload, calls: () => calls };
}

test('token windows preserve all tokens and weight overlapping chunks only by newly covered tokens', () => {
  const ids = Array.from({ length: 33 }, (_, index) => index);
  const windows = tokenWindows(ids, settings);
  assert.deepEqual(windows.map(window => window.tokens.length), [16, 16, 9]);
  assert.equal(windows.reduce((sum, window) => sum + window.weight, 0), ids.length);
  assert.deepEqual([...new Set(windows.flatMap(window => window.tokens))], ids);
  assert.equal(tokenWindows(ids, { ...settings, chunking: 'truncate' }).length, 1);
  assert.deepEqual(tokenWindows([], settings), []);
  assert.deepEqual(tokenWindows(Array(30).fill(1), { ...settings, size: 11 }).map(chunk => chunk.weight), [11, 7, 7, 5]);
  assert.throws(() => sentenceSettings({ ...settings, overlap: 16 }));
  assert.throws(() => sentenceSettings({ ...settings, size: 512 }));
});

test('description-prefixed means contextualize every chunk, skip empty fields and invalidate changed prefixes', async () => {
  const batches = [];
  const encoder = new SentenceEncoder(text => [...text].map(char => char.codePointAt(0)), async windows => {
    batches.push(...windows);
    return windows.map(ids => new Float32Array([ids[0], 1]));
  }, undefined, { ...sentenceModel, dimensions: 2 });
  const payload = { revision: 1, combine: 'description-mean', sentence: settings, weights: {},
    fields: [{ name: 'a', description: 'Alpha' }, { name: 'b', description: 'Beta' }],
    rows: [{ a: 'x'.repeat(30), b: 'y' }, { a: '', b: null }, { a: null, b: 'z' }] };
  const result = await encoder.embed(payload, () => {});
  assert.deepEqual(result.rowIds, [0, 2]);
  assert.equal(result.dimensions, 2);
  assert.equal(result.coverage[0].matched, 30);
  assert.equal(result.coverage[0].descriptionTokensPerChunk, 5);
  assert.ok(batches.every(ids => ids.length <= settings.size && [65, 66].includes(ids[0])));
  const initial = batches.length;
  const weighted = await encoder.embed({ ...payload, weights: { a: 0 } }, () => {});
  assert.equal(batches.length, initial);
  assert.deepEqual([...weighted.features.slice(0, 2)], [...weighted.features.slice(2, 4)]);
  payload.fields[0].description = 'Zeta';
  await encoder.embed(payload, () => {});
  assert.equal(batches.length - initial, 4);
  assert.ok(batches.slice(initial).every(ids => ids[0] === 90));
  const plain = await encoder.embed({ ...payload, combine: 'mean' }, () => {});
  assert.equal(plain.coverage[0].descriptionTokensPerChunk, undefined);
  assert.ok(batches.slice(-5).every(ids => [120, 121, 122].includes(ids[0])));
  await assert.rejects(encoder.embed({ ...payload, sentence: { ...settings, overlap: 15 } }, () => {}), /Reduce overlapping/);
});

test('grouped aggregation is offered only for sentence embeddings', () => {
  assert.deepEqual(fieldCombinationOptions('words').map(([value]) => value), ['mean', 'concat']);
  assert.deepEqual(fieldCombinationOptions('sentences').map(([value]) => value), ['mean', 'group-mean', 'concat']);
});

test('per-field sentence cache survives weights/aggregation changes and invalidates only changed text', async () => {
  const { encode, payload, calls } = fixture();
  const first = await encode.embed(payload, () => {});
  assert.deepEqual(first.rowIds, [0, 1]);
  assert.equal(first.dimensions, 384);
  assert.equal(first.coverage[0].missing, 2);
  const initial = calls();
  const concat = await encode.embed({ ...payload, combine: 'concat', weights: { positive: 2 } }, () => {});
  assert.equal(calls(), initial);
  assert.equal(concat.dimensions, 768);
  assert.ok(concat.features.every(Number.isFinite));
  payload.rows[0].positive = 'changed';
  await encode.embed(payload, () => {});
  assert.equal(calls(), initial + 1);
  payload.revision += 1;
  await encode.embed(payload, () => {});
  assert.equal(calls(), initial + 3);
});

test('first-chunk coverage, missing fields, zero weights and bounded cache have explicit behavior', async () => {
  const { encode, payload, calls } = fixture(0);
  payload.rows[0].positive = 'x'.repeat(35);
  payload.sentence = { ...settings, chunking: 'truncate' };
  const first = await encode.embed(payload, () => {});
  assert.equal(first.coverage[0].truncated, 1);
  assert.equal(first.coverage[0].matched, 16);
  assert.equal(first.coverage[0].total, 35);
  assert.equal(encode.bytes, 0);
  const initial = calls();
  await encode.embed(payload, () => {});
  assert.ok(calls() > initial);
  const zeros = await encode.embed({ ...payload, weights: { positive: 0, negative: 0 } }, () => {});
  assert.deepEqual(zeros.rowIds, []);
  assert.equal(zeros.features.length, 0);
});

test('sentence model inputs preserve exact token IDs, special tokens and padding masks', () => {
  class Tensor {
    constructor(type, data, dims) { Object.assign(this, { type, data, dims }); }
  }
  const tokenizer = { encode: () => [0, 2], pad_token_id: 1 };
  const inputs = sentenceInputs([[10, 20], [30]], tokenizer, Tensor);
  assert.deepEqual(inputs.input_ids.dims, [2, 4]);
  assert.deepEqual([...inputs.input_ids.data], [0n, 10n, 20n, 2n, 0n, 30n, 2n, 1n]);
  assert.deepEqual([...inputs.attention_mask.data], [1n, 1n, 1n, 1n, 1n, 1n, 1n, 0n]);
  assert.ok([...inputs.token_type_ids.data].every(value => value === 0n));
});

test('cross-record batches group lengths and preserve row mapping and chunk-weighted vectors', async () => {
  const batches = [];
  const texts = ['a'.repeat(33), 'b'.repeat(3), '', 'c'.repeat(17)];
  const infer = async windows => {
    batches.push(windows.map(ids => ids.length));
    return windows.map(ids => {
      const vector = new Float32Array(sentenceModel.dimensions);
      vector[0] = ids.length;
      vector[1] = ids[0];
      return vector;
    });
  };
  const encoder = new SentenceEncoder(text => [...text].map(char => char.codePointAt(0)), infer);
  const output = await encoder.embed({ revision: 1, rows: texts.map(text => ({ text })),
    fields: [{ name: 'text' }], weights: {}, combine: 'mean', sentence: settings }, () => {});
  assert.equal(batches.length, 1);
  assert.deepEqual(batches[0], [3, 5, 9, 16, 16, 16]);
  assert.deepEqual(output.rowIds, [0, 1, 3]);
  const firstX = 16 * 16 + 16 * 12 + 9 * 5;
  const firstY = 97 * 33;
  assert.ok(Math.abs(output.features[0] - firstX / Math.hypot(firstX, firstY)) < 1e-6);
  assert.equal(output.coverage[0].matched, 53);
  assert.equal(output.coverage[0].missing, 1);
});


test('sentence progress advances between sorting blocks without changing inference batch limits', async () => {
  const progress = [], batches = [];
  const texts = Array.from({ length: 130 }, (_, row) => row === 129 ? '' : String(row));
  const tokenize = text => Array.from({ length: text === '0' ? 129 : 3 }, () => Number(text) + 1);
  await embedRecords(texts, { ...settings, dimensions: 2 }, tokenize, async windows => {
    batches.push(windows);
    return windows.map(() => new Float32Array([1, 0]));
  }, update => progress.push(update.completed));
  assert.ok(batches.every(batch => batch.length <= 8));
  assert.equal(progress[0], 8);
  assert.ok(progress.some(completed => completed > 8 && completed < 128));
  assert.equal(progress.at(-1), texts.length);
  assert.ok(progress.every((completed, index) => index === 0 || completed >= progress[index - 1]));
  assert.equal(batches.flat().filter(tokens => tokens[0] === 1).length, tokenWindows(tokenize('0'), settings).length);
});
