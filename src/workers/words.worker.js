import { withBase } from '../base.js';
import { tokens, normalize, poolWords, inverseFrequency, combineFields, weightOf } from '../word-vectors.js';
import { asset } from './assets.js';

let loaded;
const cache = new Map();

async function loadModel(language, report) {
  if (loaded?.language === language) { return loaded; }
  const base = withBase(`vendor/vectors/${language}`);
  const read = name => asset(`${base}/${name}`, counts => report({ message: `Loading ${language.toUpperCase()} word vectors`, ...counts }));
  const manifest = JSON.parse(new TextDecoder().decode(await read('manifest.json')));
  const words = JSON.parse(new TextDecoder().decode(await read('words.json')));
  const values = new Float32Array((await read('vectors.f32')).buffer);
  if (values.length !== manifest.rows * manifest.dimensions) { throw new Error('Invalid local vector table.'); }
  loaded = { language, words, values, dimensions: manifest.dimensions };
  cache.clear();
  return loaded;
}

function wordDocuments(payload, field) {
  if (payload.documents) { return payload.documents[field]; }
  const stopwords = new Set(payload.stopwords);
  return payload.rows.map(row => tokens(row[field], stopwords));
}

async function fieldVectors(payload, field, model, report) {
  const documents = wordDocuments(payload, field);
  const key = JSON.stringify([payload.pooling, documents]);
  if (cache.get(field)?.key === key) { return cache.get(field); }
  const idf = payload.pooling === 'tfidf' ? inverseFrequency(documents) : new Map();
  const values = new Float32Array(payload.rows.length * model.dimensions);
  let matched = 0, total = 0;
  for (let i = 0; i < documents.length; i += 1) {
    const result = poolWords(documents[i], model, idf);
    values.set(normalize(result.vector), i * model.dimensions);
    matched += result.matched;
    total += documents[i].length;
    if (i % 100 === 0) {
      report({ message: `Embedding ${field}`, completed: i, total: documents.length });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  const result = { key, values, matched, total };
  cache.set(field, result);
  return result;
}

async function embed(payload, report) {
  const model = await loadModel(payload.vectorLanguage, report);
  const fields = payload.fields.map(field => field.name);
  const results = [];
  for (const field of fields) { results.push(await fieldVectors(payload, field, model, report)); }
  const dimensions = model.dimensions * (payload.combine === 'concat' ? fields.length : 1);
  const features = new Float32Array(payload.rows.length * dimensions);
  const rowIds = [];
  for (let i = 0; i < payload.rows.length; i += 1) {
    const vectors = results.map(result => result.values.subarray(i * model.dimensions, (i + 1) * model.dimensions));
    const vector = combineFields(vectors, fields.map(field => weightOf(payload.weights, field)), payload.combine);
    if (!vector.some(value => value !== 0)) { continue; }
    features.set(vector, rowIds.length * dimensions);
    rowIds.push(i);
  }
  report({ message: 'Word embeddings complete', completed: payload.rows.length, total: payload.rows.length });
  return { features: features.slice(0, rowIds.length * dimensions), dimensions, rowIds,
    coverage: results.map((result, i) => ({ field: fields[i], matched: result.matched, total: result.total })) };
}

self.onmessage = async ({ data: { id, payload } }) => {
  try {
    const result = await embed(payload, progress => self.postMessage({ id, progress }));
    self.postMessage({ id, result }, [result.features.buffer]);
  } catch (error) { self.postMessage({ id, error: String(error.message ?? error) }); }
};
