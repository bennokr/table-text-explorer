import source from './analysis.py?raw';

let runtime;

async function initialize(id) {
  if (runtime) { return runtime; }
  self.postMessage({ id, progress: 'Loading local Python runtime…' });
  const url = '/vendor/pyodide/pyodide.mjs';
  const { loadPyodide } = await import(/* @vite-ignore */ url);
  const python = await loadPyodide({ indexURL: '/vendor/pyodide/' });
  self.postMessage({ id, progress: 'Loading scikit-learn…' });
  await python.loadPackage('scikit-learn');
  await python.runPythonAsync(source);
  runtime = python;
  return python;
}

self.onmessage = async ({ data: { id, payload } }) => {
  try {
    const python = await initialize(id);
    self.postMessage({ id, progress: 'Preparing features for all records…' });
    python.globals.set('payload', JSON.stringify(payload));
    const result = JSON.parse(await python.runPythonAsync('run_projection(payload)'));
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error.message ?? error) });
  }
};
