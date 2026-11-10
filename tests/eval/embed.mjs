// Embeds one text field with the app's own encoders, offline, and writes float32 vectors.
// Usage: node tests/eval/embed.mjs <records.json> <field> <kind> <output-prefix>
// kind: words-mean | words-tfidf | sentences-multilingual | sentences-dutch
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { stopwordList } from '../../src/features.js';
import { tokens, normalize, poolWords, inverseFrequency } from '../../src/word-vectors.js';

const root = new URL('../../', import.meta.url);
const [recordsPath, field, kind, prefix] = process.argv.slice(2);
const rows = JSON.parse(await readFile(recordsPath, 'utf8'));

async function wordVectors(pooling) {
  const folder = new URL('public/vendor/vectors/nl/', root);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', folder), 'utf8'));
  const words = JSON.parse(await readFile(new URL('words.json', folder), 'utf8'));
  const bytes = await readFile(new URL('vectors.f32', folder));
  const values = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  const model = { words, values, dimensions: manifest.dimensions };
  // Mirrors fieldVectors in src/workers/words.worker.js, which cannot be imported outside a worker.
  const stopwords = new Set(stopwordList({ language: 'nl', stopwords: '' }, true));
  const documents = rows.map(row => tokens(row[field], stopwords));
  const idf = pooling === 'tfidf' ? inverseFrequency(documents) : new Map();
  const features = new Float32Array(rows.length * model.dimensions);
  let matched = 0, total = 0;
  documents.forEach((document, index) => {
    const result = poolWords(document, model, idf);
    features.set(normalize(result.vector), index * model.dimensions);
    matched += result.matched;
    total += document.length;
  });
  return { features, dimensions: model.dimensions, coverage: { matched, total } };
}

async function sentenceVectors(key) {
  const ort = await import('onnxruntime-web');
  globalThis[Symbol.for('onnxruntime')] = ort;
  const { PreTrainedTokenizer, Tensor, mean_pooling } = await import('../../node_modules/@huggingface/transformers/dist/transformers.web.js');
  const { SentenceEncoder } = await import('../../src/sentence-encoder.js');
  const { sentenceModelFor } = await import('../../src/sentence-models.js');
  const { inferSentences } = await import('../../src/sentence-inference.js');
  const spec = sentenceModelFor(key);
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = fileURLToPath(new URL('public/vendor/ort/', root));
  const folder = new URL(`public/vendor/models/${spec.id}/`, root);
  const read = async name => JSON.parse(await readFile(new URL(name, folder), 'utf8'));
  const tokenizer = new PreTrainedTokenizer(await read('tokenizer.json'), await read('tokenizer_config.json'));
  const session = await ort.InferenceSession.create(await readFile(new URL('onnx/model_quantized.onnx', folder)),
    { executionProviders: ['wasm'] });
  const run = async inputs => {
    const outputs = await session.run(Object.fromEntries(Object.entries(inputs).map(([name, value]) =>
      [name, new ort.Tensor(value.type, value.data, value.dims)])));
    return Object.fromEntries(Object.entries(outputs).map(([name, value]) => [name, new Tensor(value.type, value.data, value.dims)]));
  };
  const extractor = { tokenizer, model: run };
  const encoder = new SentenceEncoder(text => tokenizer.encode(text, { add_special_tokens: false }),
    windows => inferSentences(windows, extractor, { Tensor, mean_pooling }), undefined, spec);
  const started = performance.now();
  const payload = { revision: 1, sentence: { chunking: 'chunks', size: 126, overlap: 0 }, fields: [{ name: field }],
    weights: {}, combine: 'mean', rows };
  const output = await encoder.embed(payload, ({ completed, total }) => {
    if (completed % 500 === 0) { console.log(`${completed}/${total} ${((performance.now() - started) / 1000).toFixed(0)}s`); }
  });
  if (output.rowIds.length !== rows.length) { throw new Error('Some records produced no vector.'); }
  return { features: output.features, dimensions: output.dimensions, coverage: output.coverage[0] };
}

const kinds = {
  'words-mean': () => wordVectors('mean'),
  'words-tfidf': () => wordVectors('tfidf'),
  'sentences-multilingual': () => sentenceVectors('multilingual'),
  'sentences-dutch': () => sentenceVectors('dutch'),
};
const { features, dimensions, coverage } = await kinds[kind]();
await writeFile(`${prefix}.f32`, Buffer.from(features.buffer, features.byteOffset, features.byteLength));
await writeFile(`${prefix}.json`, JSON.stringify({ kind, field, rows: rows.length, dimensions, coverage }));
console.log(`wrote ${prefix}.f32 (${rows.length} x ${dimensions})`);
