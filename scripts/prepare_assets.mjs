import { prepareDutchModel } from './prepare_dutch_model.mjs';
import { restoreModelRelease } from './restore_model_release.mjs';
import { sentenceModel } from '../src/sentence-vectors.js';
import { copyFile, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = 'public/vendor';
const manifest = [];

async function download(url, path, expectedHash) {
  await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  const existing = await readFile(path).catch(error => { if (error.code === 'ENOENT') { return null; } throw error; });
  if (expectedHash && existing && createHash('sha256').update(existing).digest('hex') === expectedHash) {
    manifest.push({ url, path, bytes: existing.length, sha256: expectedHash });
    console.log(`${path}: verified local asset`);
    return;
  }
  const response = await fetch(url);
  if (!response.ok) { throw new Error(`${response.status}: ${url}`); }
  const data = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(data).digest('hex');
  if (expectedHash && sha256 !== expectedHash) { throw new Error(`Hash mismatch: ${path}`); }
  await writeFile(path, data);
  manifest.push({ url, path, bytes: data.length, sha256 });
  console.log(`${path}: ${data.length} bytes`);
}

async function pythonAssets() {
  const directory = `${root}/pyodide`;
  await mkdir(directory, { recursive: true });
  const names = await readdir('node_modules/pyodide');
  for (const name of names) {
    if (/\.(js|mjs|wasm|zip|json)$/.test(name)) {
      await copyFile(`node_modules/pyodide/${name}`, `${directory}/${name}`);
    }
  }
  const lock = JSON.parse(await readFile(`${directory}/pyodide-lock.json`, 'utf8'));
  const pending = ['scikit-learn'];
  const seen = new Set();
  while (pending.length) {
    const name = pending.pop();
    if (seen.has(name)) { continue; }
    seen.add(name);
    const entry = lock.packages[name];
    pending.push(...entry.depends);
    await download(`https://cdn.jsdelivr.net/pyodide/v0.29.0/full/${entry.file_name}`,
      `${directory}/${entry.file_name}`, entry.sha256);
  }
}

async function browserAssets() {
  await mkdir(`${root}/bokeh`, { recursive: true });
  for (const name of ['bokeh.min.js', 'bokeh-api.min.js']) {
    await copyFile(`node_modules/@bokeh/bokehjs/build/js/${name}`, `${root}/bokeh/${name}`);
  }
  await import('./prepare_runtime.mjs');
}

async function modelAssets() {
  const { id: model, revision } = sentenceModel;
  const hashes = {
    'config.json': '05b570bff786faa5c4604152aa16f19f77ed6dfc31e47dd0f3dd987078693ac7',
    'tokenizer.json': 'b60b6b43406a48bf3638526314f3d232d97058bc93472ff2de930d43686fa441',
    'tokenizer_config.json': '3f5961b9ac86288cccdb97f32fb848d6187c78e1603958c53f3ea1f296b7d8a2',
    'special_tokens_map.json': '06e405a36dfe4b9604f484f6a1e619af1a7f7d09e34a8555eb0b77b66318067f',
    'onnx/model_quantized.onnx': '66fc00f5f29afcaff34092e1bdd20008ca3918265a82fb9695a551e510cc4ebc',
  };
  for (const [file, hash] of Object.entries(hashes)) {
    await download(`https://huggingface.co/${model}/resolve/${revision}/${file}`,
      `${root}/models/${model}/${file}`, hash);
  }
  await copyFile('node_modules/@huggingface/transformers/LICENSE', `${root}/models/${model}/LICENSE.txt`);
  await writeFile(`${root}/models/${model}/provenance.json`, JSON.stringify({ ...sentenceModel,
    source: `https://huggingface.co/${model}/tree/${revision}`,
    original: 'https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    license: 'Apache-2.0', pooling: 'Attention-masked mean, normalized', dtype: 'q8', hashes }, null, 2));
}

if (!process.argv.includes('--model-only')) {
  await pythonAssets();
  await browserAssets();
  await import('./prepare_examples.mjs');
}
if (process.argv.includes('--model') || process.argv.includes('--model-only')) {
  // The pinned release avoids the Hugging Face download and the torch export of the Dutch model.
  const restored = await restoreModelRelease();
  if (restored) { manifest.push(...restored); } else { await modelAssets(); await prepareDutchModel(); }
}
const previous = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8').catch(error => {
  if (error.code === 'ENOENT') { return '[]'; }
  throw error;
}));
const entries = new Map([...previous, ...manifest].map(entry => [entry.path, entry]));
await writeFile(`${root}/manifest.json`, JSON.stringify([...entries.values()], null, 2));
