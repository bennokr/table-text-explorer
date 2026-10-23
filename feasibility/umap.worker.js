import { UMAP } from 'umap-js';

function randomGenerator() {
  let seed = 42;
  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

self.onmessage = ({ data }) => {
  try {
    const random = randomGenerator();
    const points = Array.from({ length: data.rows }, (_, row) =>
      Array.from({ length: 16 }, () => row % 4 * 3 + random()));
    const started = performance.now();
    const umap = new UMAP({ nComponents: 2, nNeighbors: 15, nEpochs: 100, random });
    const coordinates = umap.fit(points);
    self.postMessage({ result: {
      rows: coordinates.length,
      finite: coordinates.every(point => point.every(Number.isFinite)),
      seconds: (performance.now() - started) / 1000,
    } });
  } catch (error) {
    self.postMessage({ error: String(error.stack ?? error) });
  }
};
