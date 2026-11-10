// Fits UMAP with the app's own settings (umap-js, seeded as in src/workers/umap.worker.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { UMAP } from 'umap-js';

function seededRandom() {
  let value = 42;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

const [input, output] = process.argv.slice(2);
const { features, neighbors, epochs } = JSON.parse(readFileSync(input, 'utf8'));
const umap = new UMAP({ nComponents: 2, nNeighbors: neighbors, nEpochs: epochs, random: seededRandom() });
const coordinates = await umap.fitAsync(features);
writeFileSync(output, JSON.stringify(coordinates));
