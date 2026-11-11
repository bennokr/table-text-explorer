import { withBase } from '../base.js';
import densitySource from './density.py?raw';
import source from './analysis.py?raw';
import termsSource from './terms.py?raw';
import clusteringSource from './clustering.py?raw';
import groupsSource from './term_groups.py?raw';
import namesSource from './cluster_names.py?raw';
import lexicalSource from './lexical.py?raw';
import phraseQueries from './phrase_queries.py?raw';
import indexesSource from './text_indexes.py?raw';
import rankingSource from './term_ranking.py?raw';
import facetsSource from './facets.py?raw';
import descriptionsSource from './descriptions.py?raw';
import screenSource from './column_screen.py?raw';

let runtime;
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
  python.FS.writeFile('/home/pyodide/text_indexes.py', indexesSource);
  python.FS.writeFile('/home/pyodide/lexical.py', lexicalSource);
  python.FS.writeFile('/home/pyodide/term_ranking.py', rankingSource);
  python.FS.writeFile('/home/pyodide/facets.py', facetsSource);
  await python.runPythonAsync(source);
  await python.runPythonAsync(termsSource);
  await python.runPythonAsync(densitySource);
  await python.runPythonAsync(clusteringSource);
  await python.runPythonAsync(groupsSource);
  await python.runPythonAsync(namesSource);
  await python.runPythonAsync(phraseQueries);
  await python.runPythonAsync(descriptionsSource);
  await python.runPythonAsync(screenSource);
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
    const python = await initialize(id);
    if (payload.task === 'initialize') { self.postMessage({ id, result: true }); return; }
    const functions = { descriptions_describe: 'describe_descriptions', phrase_matches: 'match_phrases', terms_tokens: 'index_tokens', cluster_names: 'name_clusters', density_select: 'run_density_selection', cluster: 'run_clustering', terms_groups: 'describe_groups', terms_build: 'build_term_index', terms_describe: 'describe_terms', terms_matches: 'matching_terms', column_screen: 'run_column_screen' };
    const operation = functions[payload.task] ?? 'run_projection';
    self.postMessage({ id, progress: operationMessage(payload.task) });
    python.globals.set('terms_progress', (message, completed, total) => self.postMessage({ id,
      progress: { message, completed, total } }));
    const { features, ...parameters } = payload;
    python.globals.set('embedding_values', features ?? null);
    python.globals.set('payload', JSON.stringify(parameters));
    const result = JSON.parse(await python.runPythonAsync(`${operation}(payload)`));
    self.postMessage({ id, result });
  } catch (error) {
    initializationFailure(id);
    self.postMessage({ id, error: String(error.message ?? error) });
  }
};
