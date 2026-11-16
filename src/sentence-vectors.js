import { sentenceAggregation } from './group-vectors.js';

import { sentenceModelFor } from './sentence-models.js';

export const sentenceModel = sentenceModelFor();

export function fieldCombinationOptions(mode) {
  const entries = [['mean', 'Mean across columns'], ['concat', 'Keep columns separate']];
  if (mode === 'sentences') { entries.splice(1, 0, ['group-mean', 'Mean within groups']); }
  return entries;
}

export function sentencePrefix(field, settings, tokenize) {
  const description = sentenceText(field.description ?? field.name);
  const prefix = description ? tokenize(`${description}:`).slice(0, Math.min(32, Math.floor(settings.size / 3))) : [];
  if (settings.overlap >= settings.size - prefix.length) {
    throw new Error('Reduce overlapping tokens to leave room for the field description and text.');
  }
  return prefix;
}

function validChunkSize(size, maximum) { return Number.isInteger(size) && size >= 16 && size <= maximum - 2; }

export function sentenceSettings(config, model = sentenceModel) {
  const { chunking, size, overlap } = config;
  if (!['chunks', 'truncate'].includes(chunking)) { throw new Error('Choose chunking or first-window text.'); }
  if (!validChunkSize(size, model.maxTokens)) {
    throw new Error('Sentence chunk size must be between 16 and 126 tokens.');
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= size) {
    throw new Error('Chunk overlap must be nonnegative and smaller than the chunk size.');
  }
  return { chunking, size, overlap };
}

export function tokenWindows(ids, config) {
  const windows = [];
  for (let start = 0; start < ids.length; start += config.size - config.overlap) {
    const tokens = ids.slice(start, start + config.size);
    windows.push({ tokens, weight: tokens.length - (start ? config.overlap : 0) });
    if (config.chunking === 'truncate' || start + config.size >= ids.length) { break; }
  }
  return windows;
}

export function sentenceText(value) {
  if (value === null || value === undefined || value === '\\N') { return ''; }
  return String(value).trim();
}

export function combineSentenceFields(payload, results, model = sentenceModel) {
  const fields = payload.fields.map(field => field.name);
  const aggregation = sentenceAggregation(payload, model.dimensions);
  const dimensions = aggregation.dimensions;
  const features = new Float32Array(payload.rows.length * dimensions), rowIds = [];
  for (let row = 0; row < payload.rows.length; row += 1) {
    const vectors = results.map(result => result.values.subarray(row * model.dimensions, (row + 1) * model.dimensions));
    const vector = aggregation.combine(vectors);
    if (!vector.some(value => value !== 0)) { continue; }
    features.set(vector, rowIds.length * dimensions);
    rowIds.push(row);
  }
  return { features: features.slice(0, rowIds.length * dimensions), dimensions, rowIds,
    sentenceModel: model, aggregation: aggregation.recipe,
    coverage: results.map((result, index) => ({ field: fields[index], ...result.coverage })) };
}
