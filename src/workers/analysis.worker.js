import { withBase } from '../base.js';
// Every Python module is written to the worker's file system and imported by name; worker_entry.py
// imports the task functions explicitly. The page shares only embeddings and a progress callback (bridge.py).
const modules = import.meta.glob('./*.py', { query: '?raw', import: 'default', eager: true });

let runtime;
let bridge; // Python modules for the page's side of the bridge, kept so no proxy is made per request.
let entry;
let readiness = { python: 'idle', sklearn: 'idle' };

function ready(id, update) {
  readiness = { ...readiness, ...update };
  self.postMessage({ id, runtime: readiness });
}

async function initialize(id) {
  if (runtime) { return runtime; }
  ready(id, { python: 'loading' });
  self.postMessage({ id, progress: 'Loading local Python runtime…' });
  // Absolute URLs keep Vite from treating this public asset as a source import.
  const url = new URL(withBase('vendor/pyodide/pyodide.mjs'), self.location.origin).href;
  const { loadPyodide } = await import(/* @vite-ignore */ url);
  const python = await loadPyodide({ indexURL: withBase('vendor/pyodide/') });
  ready(id, { python: 'loaded', sklearn: 'loading' });
  self.postMessage({ id, progress: 'Loading scikit-learn…' });
  await python.loadPackage('scikit-learn');
  ready(id, { sklearn: 'loaded' });
  for (const [path, source] of Object.entries(modules)) {
    python.FS.writeFile(`/home/pyodide/${path.slice(2)}`, source);
  }
  bridge = python.pyimport('bridge');
  entry = python.pyimport('worker_entry');
  runtime = python;
  return python;
}

function operationMessage(task) {
  const messages = { phrase_matches: 'Matching exact phrases', density_select: 'Selecting groups from the saved density tree',
    cluster: 'Fitting clustering on all records', terms_build: 'Counting phrases on all records',
    terms_tokens: 'Reusing lexical tokens for word vectors', column_screen: 'Screening columns against the text' };
  return messages[task] ?? 'Preparing analysis';
}

function initializationFailure(id) {
  if (runtime) { return; }
  ready(id, { python: readiness.python === 'loaded' ? 'loaded' : 'failed', sklearn: 'failed' });
}

self.onmessage = async ({ data: { id, payload } }) => {
  try {
    await initialize(id);
    if (payload.task === 'initialize') { self.postMessage({ id, result: true }); return; }
    self.postMessage({ id, progress: operationMessage(payload.task) });
    const { features, ...parameters } = payload;
    bridge.progress_callback = (message, completed, total) => self.postMessage({ id, progress: { message, completed, total } });
    bridge.embedding_values = features ?? null;
    const result = JSON.parse(entry.run(payload.task, JSON.stringify(parameters)));
    self.postMessage({ id, result });
  } catch (error) {
    initializationFailure(id);
    self.postMessage({ id, error: String(error.message ?? error) });
  }
};
