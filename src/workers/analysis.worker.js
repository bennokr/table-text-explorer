import source from './analysis.py?raw';

let runtime;

async function initialize(id) {
  if (runtime) { return runtime; }
  self.postMessage({ id, progress: 'Loading local Python runtime…' });
  // Absolute URLs keep Vite from treating this public asset as a source import.
  const url = new URL('/vendor/pyodide/pyodide.mjs', self.location.origin).href;
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
    self.postMessage({ id, progress: payload.mode === 'prepared' ? `Fitting ${payload.method.toUpperCase()}` : 'Reducing all-record features with SVD' });
    const { features, ...parameters } = payload;
    python.globals.set('embedding_values', features ?? null);
    python.globals.set('payload', JSON.stringify(parameters));
    const result = JSON.parse(await python.runPythonAsync('run_projection(payload)'));
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error.message ?? error) });
  }
};
