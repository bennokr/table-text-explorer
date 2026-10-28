import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';

// Browser Transformers uses asyncify; the offline Node/WASM probe uses the base pair.
const runtimeFiles = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'];
const destination = 'public/vendor/ort';
await mkdir(destination, { recursive: true });
for (const name of await readdir(destination)) {
  if (/^ort.*\.(mjs|wasm)$/.test(name) && !runtimeFiles.includes(name)) {
    await rm(`${destination}/${name}`);
  }
}
for (const name of runtimeFiles) {
  await copyFile(`node_modules/onnxruntime-web/dist/${name}`, `${destination}/${name}`);
}
await copyFile('licenses/onnxruntime.txt', `${destination}/LICENSE`);
console.log('Prepared local WASM runtime pairs; unused GPU and JSPI variants removed.');
