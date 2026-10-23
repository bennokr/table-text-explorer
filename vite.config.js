import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { 'node:zlib': fileURLToPath(new URL('./feasibility/zlib.js', import.meta.url)) } },
  worker: { format: 'es' },
  server: { host: '127.0.0.1' },
  build: { target: 'esnext' },
});
