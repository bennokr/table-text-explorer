import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';

// Inspect filenames and manifests only; never read or publish private fixture data.
const examples = JSON.parse(await readFile('dist/examples.json', 'utf8'));
assert.ok(examples.every(example => example.bundled));
const approved = (await readdir('examples')).filter(name => /\.(csv|json|sav|xlsx)$/i.test(name)).sort();
// Released datasets (data-v1) and their embeddings are approved too; a build without the release has none of them.
const release = JSON.parse(await readFile('scripts/data-release.json', 'utf8'));
const released = release.datasets.flatMap(dataset => dataset.assets.map(asset => asset.name));
const bundled = (await readdir('dist/fixtures')).sort();
assert.deepEqual(bundled.filter(name => !approved.includes(name) && !released.includes(name)), [], 'only approved files are distributed');
assert.deepEqual(approved.filter(name => !bundled.includes(name)), [], 'every approved example is distributed');
assert.deepEqual((await readdir('dist/demos')).sort(), examples.filter(example => example.demo).map(example => example.name).sort());
for (const path of ['dist/reference']) {
  assert.equal(await stat(path).catch(error => {
    if (error.code === 'ENOENT') { return null; }
    throw error;
  }), null, `${path} must not be distributed`);
}
assert.ok(!(await readdir('dist/assets')).some(name => name.endsWith('.wasm')), 'No duplicate bundled runtime');
assert.deepEqual((await readdir('dist/vendor/ort')).sort(), ['LICENSE',
  'ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'].sort());
console.log('App-only bundle: approved examples, no private references, minimal WASM assets, no duplicate runtime.');
