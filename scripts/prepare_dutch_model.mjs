import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { sentenceModels } from '../src/sentence-models.js';

const model = sentenceModels.dutch;
const source = 'vendor/sentence-source/dutch';
const target = `public/vendor/models/${model.id}`;
const hashes = {
  'config.json': 'd6b4afd0db5e69660934d545ff3efe79c8197da742d4dbadc3a9624cddd767b4',
  'tokenizer.json': 'a5fa5a652e3759eb3e7cc25dac5da2fb240c99e7a727987436f014b4e8f2428e',
  'tokenizer_config.json': '1fb165a29ea116e53ebbc40d5e79f51588a18951f5a76ecd21ba84bf2513d536',
  'README.md': '35e4f38b74b1d1ebcbea39e7487f91135a7b7a818f7136f0f228a1df14e18209',
  'model.safetensors': '9df5206b38bcf8ced1cd65599d227205149ff83d9429b7da10bd64938a2a108b',
};
const quantized = 'bafced50e9b9c0f28bb8fb604e64f6c6cdd34ba6317c6321079adbf383bbcc5e';
const digest = data => createHash('sha256').update(data).digest('hex');

async function valid(path, hash) {
  const data = await readFile(path).catch(error => { if (error.code === 'ENOENT') { return null; } throw error; });
  return data && digest(data) === hash;
}

async function ensureFile(name, destination) {
  if (await valid(destination, hashes[name])) { return; }
  if (await valid(`${source}/${name}`, hashes[name])) { await copyFile(`${source}/${name}`, destination); }
  else { execFileSync('curl', ['-fsSL', `https://huggingface.co/${model.id}/resolve/${model.revision}/${name}`, '-o', destination]); }
  if (!await valid(destination, hashes[name])) { throw new Error(`Invalid Dutch model asset: ${name}`); }
}

async function ensureExport() {
  if (await valid(`${target}/onnx/model_quantized.onnx`, quantized)) { return; }
  await mkdir(source, { recursive: true });
  for (const name of Object.keys(hashes)) { await ensureFile(name, `${source}/${name}`); }
  execFileSync('uv', ['run', '--cache-dir', '.cache/uv', '--script', 'scripts/prepare_dutch_sentences.py', source, `${target}/onnx/model_quantized.onnx`], { stdio: 'inherit' });
  if (!await valid(`${target}/onnx/model_quantized.onnx`, quantized)) { throw new Error('Dutch ONNX export differs from its pinned hash.'); }
}

export async function prepareDutchModel() {
  await mkdir(`${target}/onnx`, { recursive: true });
  await ensureExport();
  for (const name of ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'README.md']) {
    await ensureFile(name, `${target}/${name}`);
  }
  await copyFile('node_modules/@huggingface/transformers/LICENSE', `${target}/LICENSE.txt`);
  await writeFile(`${target}/provenance.json`, JSON.stringify({ ...model, sourceHashes: hashes,
    quantizedSha256: quantized, license: 'Apache-2.0', dtype: 'q8', quantization: 'Per-channel matrix weights; embedding tables retained at full precision', pooling: 'Attention-masked mean, normalized',
    export: 'scripts/prepare_dutch_sentences.py', source: `https://huggingface.co/${model.id}/tree/${model.revision}` }, null, 2));
}
