import source from './analysis.py?raw';

let runtime;

self.onmessage = async ({ data }) => {
  try {
    // Load the public asset directly, without Vite's source-import transform.
    const runtimeURL = new URL('/vendor/pyodide/pyodide.mjs', self.location.origin).href;
    const { loadPyodide } = await import(/* @vite-ignore */ runtimeURL);
    runtime ??= await loadPyodide({ indexURL: '/vendor/pyodide/' });
    await runtime.loadPackage('scikit-learn');
    await runtime.runPythonAsync(source);
    runtime.globals.set('payload', JSON.stringify(data));
    const result = JSON.parse(await runtime.runPythonAsync('run_probe(payload)'));
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: String(error.stack ?? error) });
  }
};
