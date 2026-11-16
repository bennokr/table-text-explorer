// Fits UMAP with the app's own settings (umap-js, seeded as in src/workers/umap.worker.js, seed 42
// by default; other seeds measure how much a layout depends on the arbitrary choice).
import { readFileSync, writeFileSync } from 'node:fs';
import { UMAP } from 'umap-js';

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const [input, output] = process.argv.slice(2);
const { features, neighbors, epochs, seed } = JSON.parse(readFileSync(input, 'utf8'));
const umap = new UMAP({ nComponents: 2, nNeighbors: neighbors, nEpochs: epochs, random: seededRandom(seed) });
const coordinates = await umap.fitAsync(features);
writeFileSync(output, JSON.stringify(coordinates));
