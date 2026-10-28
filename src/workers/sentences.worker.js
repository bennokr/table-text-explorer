import { env, pipeline, Tensor, mean_pooling } from '@huggingface/transformers';
import { SentenceEncoder } from '../sentence-encoder.js';
import { sentenceModelFor } from '../sentence-models.js';
import { inferSentences } from '../sentence-inference.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = '/vendor/models/';
// Absolute URLs keep Vite's dev importer from adding ?import to public assets.
env.backends.onnx.wasm.wasmPaths = new URL('/vendor/ort/', self.location.origin).href;
env.backends.onnx.wasm.numThreads = 1;

let encoder, extractor, activeModel;

async function load(key, report) {
  const model = sentenceModelFor(key);
  if (encoder && activeModel === model.id) { return encoder; }
  await extractor?.dispose();
  encoder = null;
  extractor = null;
  report(`Loading local ${model.label}…`);
  extractor = await pipeline('feature-extraction', model.id, {
    device: 'wasm', dtype: 'q8', local_files_only: true,
    progress_callback: task => report({ message: `Loading sentence model · ${task.file ?? task.status}`,
      completed: task.loaded ?? 0, total: task.total ?? 0 }) });
  encoder = new SentenceEncoder(text => extractor.tokenizer.encode(text, { add_special_tokens: false }),
    windows => inferSentences(windows, extractor, { Tensor, mean_pooling }), undefined, model);
  activeModel = model.id;
  return encoder;
}

self.onmessage = async ({ data: { id, payload } }) => {
  const report = progress => self.postMessage({ id, progress });
  try {
    const instance = await load(payload.sentence.model, report);
    const result = await instance.embed(payload, report);
    self.postMessage({ id, result }, [result.features.buffer]);
  } catch (error) {
    self.postMessage({ id, error: `Sentence embeddings: ${error.message ?? error}. Ensure local model assets exist (npm run prepare:sentences).` });
  }
};
