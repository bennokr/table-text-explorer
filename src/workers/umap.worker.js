import { UMAP } from 'umap-js';

function seededRandom() {
  let value = 42;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

self.onmessage = async ({ data: { id, payload } }) => {
  try {
    if (payload.features.length < 4) { throw new Error('UMAP needs at least four records. Choose PCA or SVD.'); }
    const options = { nComponents: 2, nNeighbors: Math.min(payload.neighbors, payload.features.length - 1),
      nEpochs: payload.epochs, random: seededRandom() };
    const umap = new UMAP(options);
    // Survey maps bring their own nearest neighbours from the survey distance instead of Euclidean distance on coordinates.
    if (payload.graph) {
      umap.setPrecomputedKNN(payload.graph.indices.map(row => row.slice(0, options.nNeighbors)),
        payload.graph.distances.map(row => row.slice(0, options.nNeighbors)));
    }
    const coordinates = await umap.fitAsync(payload.features, epoch => {
      if (epoch % 10 === 0) { self.postMessage({ id, progress: {
        message: 'Fitting UMAP', completed: epoch, total: payload.epochs } }); }
    });
    if (!coordinates.every(point => point.every(Number.isFinite))) {
      throw new Error('UMAP produced invalid coordinates. Try different features or PCA.');
    }
    self.postMessage({ id, result: { coordinates } });
  } catch (error) {
    self.postMessage({ id, error: String(error.message ?? error) });
  }
};
