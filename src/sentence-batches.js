import { normalize } from './word-vectors.js';
import { tokenWindows, sentenceModel } from './sentence-vectors.js';

function collectWindows(texts, start, tokenize, settings, coverage) {
  const windows = [];
  const prefix = settings.prefix ?? [];
  const size = settings.size - prefix.length;
  for (let row = start; row < Math.min(texts.length, start + 128); row += 1) {
    const ids = texts[row] ? tokenize(texts[row]) : [];
    const chunks = tokenWindows(ids, { ...settings, size });
    coverage.total += ids.length;
    coverage.matched += chunks.reduce((sum, chunk) => sum + chunk.weight, 0);
    coverage.chunks += chunks.length;
    coverage.truncated += Number(settings.chunking === 'truncate' && ids.length > size);
    coverage.missing += Number(ids.length === 0);
    for (const chunk of chunks) { windows.push({ ...chunk, tokens: [...prefix, ...chunk.tokens], row }); }
  }
  return windows.sort((a, b) => a.tokens.length - b.tokens.length);
}

function addVectors(values, batch, vectors, dimensions) {
  if (vectors.length !== batch.length) { throw new Error('Invalid sentence embedding batch.'); }
  vectors.forEach((vector, index) => {
    if (vector.length !== dimensions || !vector.every(Number.isFinite)) { throw new Error('Invalid sentence embedding.'); }
    const { row, weight } = batch[index];
    for (let dim = 0; dim < vector.length; dim += 1) {
      values[row * vector.length + dim] += vector[dim] * weight;
    }
  });
}

function nextBatch(windows, offset) {
  const maximum = Math.ceil(windows[offset].tokens.length / 16) * 16;
  return windows.slice(offset, offset + 8).filter(window => window.tokens.length <= maximum);
}

// Length sorting mixes records. A record is complete only after all its chunks.
function pendingChunks(windows, start, length) {
  const remaining = new Uint32Array(length);
  for (const window of windows) { remaining[window.row - start] += 1; }
  return remaining;
}

function completedRecords(batch, remaining, start) {
  for (const window of batch) { remaining[window.row - start] -= 1; }
  return start + remaining.filter(count => count === 0).length;
}

export async function embedRecords(texts, settings, tokenize, infer, report) {
  const dimensions = settings.dimensions ?? sentenceModel.dimensions;
  const values = new Float32Array(texts.length * dimensions);
  const coverage = { matched: 0, total: 0, chunks: 0, truncated: 0, missing: 0 };
  for (let start = 0; start < texts.length; start += 128) {
    const windows = collectWindows(texts, start, tokenize, settings, coverage);
    const remaining = pendingChunks(windows, start, Math.min(128, texts.length - start));
    for (let offset = 0; offset < windows.length;) {
      const batch = nextBatch(windows, offset);
      addVectors(values, batch, await infer(batch.map(window => window.tokens)), dimensions);
      offset += batch.length;
      report({ completed: completedRecords(batch, remaining, start), total: texts.length });
    }
    report({ completed: Math.min(texts.length, start + 128), total: texts.length });
  }
  for (let row = 0; row < texts.length; row += 1) {
    const offset = row * dimensions;
    values.set(normalize(values.subarray(offset, offset + dimensions)), offset);
  }
  return { values, coverage };
}
