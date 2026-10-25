import source from './analysis.py?raw';
import termsSource from './terms.py?raw';

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
  await python.runPythonAsync(termsSource);
  runtime = python;
  return python;
}

self.onmessage = async ({ data: { id, payload } }) => {
  try {
    const python = await initialize(id);
    const functions = { terms_build: 'build_term_index', terms_describe: 'describe_terms', terms_matches: 'matching_terms' };
    const operation = functions[payload.task] ?? 'run_projection';
    const message = payload.task ? 'Computing n-gram descriptions' : 'Reducing features / fitting projection';
    self.postMessage({ id, progress: message });
    python.globals.set('terms_progress', (message, completed, total) => self.postMessage({ id,
      progress: { message, completed, total } }));
    const { features, ...parameters } = payload;
    python.globals.set('embedding_values', features ?? null);
    python.globals.set('payload', JSON.stringify(parameters));
    const result = JSON.parse(await python.runPythonAsync(`${operation}(payload)`));
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String(error.message ?? error) });
  }
};
