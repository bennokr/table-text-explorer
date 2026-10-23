import { env, pipeline } from '@huggingface/transformers';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/vendor/models/';
env.backends.onnx.wasm.wasmPaths = '/vendor/ort/';
env.backends.onnx.wasm.numThreads = 1;

self.onmessage = async ({ data }) => {
  try {
    const started = performance.now();
    const embed = await pipeline('feature-extraction',
      'Xenova/paraphrase-multilingual-MiniLM-L12-v2', { device: 'wasm', dtype: 'q8' });
    const output = await embed(data.texts, { pooling: 'mean', normalize: true });
    const rows = output.tolist();
    const cosine = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
    self.postMessage({ result: {
      shape: output.dims,
      finite: rows.every(row => row.every(Number.isFinite)),
      related: cosine(rows[0], rows[1]),
      unrelated: cosine(rows[0], rows[2]),
      seconds: (performance.now() - started) / 1000,
      backend: 'wasm',
    } });
  } catch (error) {
    self.postMessage({ error: String(error.stack ?? error) });
  }
};
