import { defineConfig, defaultClientConditions } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command, mode }) => {
  const feasibility = mode === 'feasibility';
  return {
    // GitHub Pages serves project sites below /<repository>/; local builds stay at '/'.
    base: process.env.BASE_PATH ?? '/',
    publicDir: command === 'serve' || feasibility ? 'public' : '.cache/public-build',
    resolve: {
      alias: { 'node:zlib': fileURLToPath(new URL('./src/zlib.js', import.meta.url)) },
      // ORT's supported external-WASM entry avoids a second bundled runtime binary.
      conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions],
    },
    worker: { format: 'es' },
    // Discover worker-only dependencies before analysis, avoiding dev-page reloads.
    optimizeDeps: { include: ['@huggingface/transformers', 'umap-js', '@irbisadm/statfmt'] },
    server: { host: '127.0.0.1' },
    build: { target: 'esnext', outDir: feasibility ? 'dist-feasibility' : 'dist',
      rolldownOptions: { input: fileURLToPath(new URL(feasibility ? './feasibility.html' : './index.html', import.meta.url)) } },
  };
});
