import { copyFile, cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = 'public/vendor';
const manifest = [];

async function download(url, path, expectedHash) {
  await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
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
  await mkdir(`${root}/ort`, { recursive: true });
  for (const name of await readdir('node_modules/onnxruntime-web/dist')) {
    if (/\.(wasm|mjs)$/.test(name)) {
      await copyFile(`node_modules/onnxruntime-web/dist/${name}`, `${root}/ort/${name}`);
    }
  }
}

async function modelAssets() {
  const model = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
  const revision = '2c4055b';
  for (const file of ['config.json', 'tokenizer.json', 'tokenizer_config.json',
    'special_tokens_map.json', 'onnx/model_quantized.onnx']) {
    await download(`https://huggingface.co/${model}/resolve/${revision}/${file}`,
      `${root}/models/${model}/${file}`);
  }
}

await pythonAssets();
await browserAssets();
await cp('fixtures', 'public/fixtures', { recursive: true });
if (process.argv.includes('--model')) { await modelAssets(); }
await writeFile(`${root}/manifest.json`, JSON.stringify(manifest, null, 2));
