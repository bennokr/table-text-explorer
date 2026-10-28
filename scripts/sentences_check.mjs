import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-web';
import { loadPyodide } from '../public/vendor/pyodide/pyodide.mjs';
import { SentenceEncoder } from '../src/sentence-encoder.js';
import { sentenceModelFor } from '../src/sentence-models.js';
const sentenceModel = sentenceModelFor(process.env.SENTENCE_MODEL);
import { inferSentences } from '../src/sentence-inference.js';

// Synthetic, offline Node/WASM evidence; intentionally independent of Playwright.
// Model execution uses onnxruntime-web's WASM provider, never the native Node EP.
globalThis[Symbol.for('onnxruntime')] = ort;
const { PreTrainedTokenizer, Tensor, mean_pooling } = await import('../node_modules/@huggingface/transformers/dist/transformers.web.js');
const previousFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Network access is disabled during the sentence check.'); };
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = fileURLToPath(new URL('../public/vendor/ort/', import.meta.url));
const started = performance.now();
const modelDirectory = new URL(`../public/vendor/models/${sentenceModel.id}/`, import.meta.url);
const tokenizer = new PreTrainedTokenizer(JSON.parse(await readFile(new URL('tokenizer.json', modelDirectory), 'utf8')),
  JSON.parse(await readFile(new URL('tokenizer_config.json', modelDirectory), 'utf8')));
const model = await ort.InferenceSession.create(
  await readFile(new URL(`../public/vendor/models/${sentenceModel.id}/onnx/model_quantized.onnx`, import.meta.url)),
  { executionProviders: ['wasm'] });
let calls = 0;
const extractor = { tokenizer, model: async inputs => {
  calls += 1;
  const outputs = await model.run(Object.fromEntries(Object.entries(inputs).map(([key, value]) =>
    [key, new ort.Tensor(value.type, value.data, value.dims)])));
  return Object.fromEntries(Object.entries(outputs).map(([key, value]) => [key, new Tensor(value.type, value.data, value.dims)]));
} };
const encoder = new SentenceEncoder(text => tokenizer.encode(text, { add_special_tokens: false }),
  windows => inferSentences(windows, extractor, { Tensor, mean_pooling }), undefined, sentenceModel);
const payload = { revision: 1, sentence: { chunking: 'chunks', size: 126, overlap: 0 },
  fields: [{ name: 'text' }], weights: {}, combine: 'mean', rows: [
    { text: 'De kat zit op de mat.' }, { text: process.env.SENTENCE_MODEL === 'dutch' ? 'Er zit een poes op het kleed.' : 'The cat sits on the mat.' },
    { text: 'Het vliegtuig vliegt naar de luchthaven.' }, { text: '' },
  ] };
const output = await encoder.embed(payload, () => {});
assert.deepEqual(output.rowIds, [0, 1, 2]);
assert.equal(output.dimensions, 384);
assert.ok(output.features.every(Number.isFinite));
const vector = row => output.features.subarray(row * 384, (row + 1) * 384);
const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
const related = dot(vector(0), vector(1)), unrelated = dot(vector(0), vector(2));
const margin = process.env.SENTENCE_MODEL === 'dutch' ? 0.05 : 0.15;
assert.ok(related > unrelated + margin, `Related ${related}; unrelated ${unrelated}`);
assert.ok(Math.abs(dot(vector(0), vector(0)) - 1) < 1e-5);
const before = calls;
await encoder.embed({ ...payload, combine: 'concat', weights: { text: 2 } }, () => {});
assert.equal(calls, before);
const longText = 'De camera maakt scherpe foto’s. '.repeat(30);
const chunks = await encoder.embed({ ...payload, rows: [{ text: longText }] }, () => {});
assert.ok(chunks.coverage[0].chunks > 1);
assert.equal(chunks.coverage[0].matched, chunks.coverage[0].total);
const truncated = await encoder.embed({ ...payload, rows: [{ text: longText }],
  sentence: { ...payload.sentence, chunking: 'truncate' } }, () => {});
assert.equal(truncated.coverage[0].truncated, 1);
assert.ok(truncated.coverage[0].matched < truncated.coverage[0].total);
const described = await encoder.embed({ ...payload, combine: 'description-mean',
  fields: [{ name: 'text', description: 'Wat zie je in je omgeving?' }] }, () => {});
assert.deepEqual(described.rowIds, output.rowIds);
assert.equal(described.dimensions, 384);
assert.ok(described.features.every(Number.isFinite));
assert.equal(described.coverage[0].missing, 1);
assert.ok(described.coverage[0].descriptionTokensPerChunk > 0);
assert.notDeepEqual(described.features, output.features);
await model.release();
const python = await loadPyodide({ indexURL: fileURLToPath(new URL('../public/vendor/pyodide/', import.meta.url)) });
await python.loadPackage('scikit-learn');
python.FS.writeFile('/home/pyodide/lexical.py', await readFile(new URL('../src/workers/lexical.py', import.meta.url), 'utf8'));
python.FS.writeFile('/home/pyodide/text_indexes.py', await readFile(new URL('../src/workers/text_indexes.py', import.meta.url), 'utf8'));
for (const name of ['analysis', 'clustering']) {
  await python.runPythonAsync(await readFile(new URL(`../src/workers/${name}.py`, import.meta.url), 'utf8'));
}
python.globals.set('embedding_values', output.features);
python.globals.set('sentence_payload', JSON.stringify({ mode: 'sentences', method: 'prepare',
  rows: output.rowIds.map(() => ({})), fields: payload.fields, dimensions: 384 }));
const prepared = JSON.parse(await python.runPythonAsync('run_projection(sentence_payload)'));
assert.equal(prepared.features.length, 3);
assert.equal(prepared.dimensions, 384);
python.globals.set('embedding_values', prepared.features);
const projection = JSON.parse(await python.runPythonAsync(`run_projection('{"mode":"prepared","method":"pca"}')`));
assert.ok(projection.coordinates.every(row => row.length === 2 && row.every(Number.isFinite)));
const clustering = JSON.parse(await python.runPythonAsync(`run_clustering('{"method":"minibatch","clusters":2,"normalize":false}')`));
assert.equal(clustering.labels[0], clustering.labels[1]);
assert.notEqual(clustering.labels[0], clustering.labels[2]);
const evidence = { runtime: 'Node / Transformers.js 4.3.1 tokenizer + pooling / ONNX Runtime Web WASM',
  model: sentenceModel, shape: [3, 384], related, unrelated, projection: 'passed', clustering: 'passed', cachedReweight: 'passed',
  chunking: chunks.coverage[0], truncation: truncated.coverage[0], contextualMean: described.coverage[0], externalFetches: 0,
  seconds: (performance.now() - started) / 1000, browserUI: 'not run' };
globalThis.fetch = previousFetch;
await mkdir('.cache/checks', { recursive: true });
await writeFile(new URL(`../.cache/checks/sentences-${process.env.SENTENCE_MODEL ?? "multilingual"}-results.json`, import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
