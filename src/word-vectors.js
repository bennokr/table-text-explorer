export function tokens(text, stopwords = new Set()) {
  if (text === null || text === undefined || text === '\\N') { return []; }
  return (String(text).match(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu) ?? [])
    .filter(word => !stopwords.has(word.toLowerCase()));
}

export function normalize(vector) {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return length ? Float32Array.from(vector, value => value / length) : vector;
}

export const weightOf = (weights, name) => Object.hasOwn(weights, name) ? weights[name] : 1;

function wordRow(words, word) {
  if (Object.hasOwn(words, word)) { return words[word]; }
  return Object.hasOwn(words, word.toLowerCase()) ? words[word.toLowerCase()] : undefined;
}

export function poolWords(words, model, idf = new Map()) {
  const vector = new Float32Array(model.dimensions);
  let matched = 0, totalWeight = 0;
  for (const word of words) {
    const row = wordRow(model.words, word);
    if (row === undefined) { continue; }
    const weight = idf.get(word.toLowerCase()) ?? 1;
    for (let d = 0; d < vector.length; d += 1) { vector[d] += weight * model.values[row * vector.length + d]; }
    matched += 1;
    totalWeight += weight;
  }
  if (totalWeight) { for (let d = 0; d < vector.length; d += 1) { vector[d] /= totalWeight; } }
  return { vector, matched };
}

export function inverseFrequency(documents) {
  const frequency = new Map();
  for (const words of documents) {
    for (const word of new Set(words.map(word => word.toLowerCase()))) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }
  }
  return new Map([...frequency].map(([word, count]) => [word, Math.log((1 + documents.length) / (1 + count)) + 1]));
}

export function combineFields(vectors, weights, mode) {
  const size = vectors[0].length;
  const result = new Float32Array(mode === 'concat' ? size * vectors.length : size);
  for (let f = 0; f < vectors.length; f += 1) {
    const weight = mode === 'concat' ? Math.sqrt(weights[f]) : weights[f];
    for (let d = 0; d < size; d += 1) {
      result[(mode === 'concat' ? f * size : 0) + d] += vectors[f][d] * weight;
    }
  }
  return normalize(result);
}
