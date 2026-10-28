import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from '../public/vendor/pyodide/pyodide.mjs';

// Direct local WASM check, intentionally independent of Playwright and fixtures.
const indexURL = fileURLToPath(new URL('../public/vendor/pyodide/', import.meta.url));
const python = await loadPyodide({ indexURL });
await python.loadPackage('scikit-learn');
python.FS.writeFile('/home/pyodide/lexical.py', await readFile(new URL('../src/workers/lexical.py', import.meta.url), 'utf8'));
python.FS.writeFile('/home/pyodide/text_indexes.py', await readFile(new URL('../src/workers/text_indexes.py', import.meta.url), 'utf8'));
for (const name of ['analysis', 'density', 'clustering', 'terms', 'term_groups']) {
  await python.runPythonAsync(await readFile(new URL(`../src/workers/${name}.py`, import.meta.url), 'utf8'));
}
const tests = await readFile(new URL('../tests/check_clustering.py', import.meta.url), 'utf8');
const numerical = tests.slice(tests.indexOf('class ClusteringChecks'), tests.indexOf('\ndef timings'));
await python.runPythonAsync(`
import unittest
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_rand_score
from types import SimpleNamespace
clustering = SimpleNamespace(cluster=cluster, select_density=select_density)
${numerical}
suite = unittest.defaultTestLoader.loadTestsFromTestCase(ClusteringChecks)
assert unittest.TextTestRunner().run(suite).wasSuccessful()
`);
const timings = JSON.parse(await python.runPythonAsync(`
from sklearn.datasets import make_blobs
from sklearn.metrics import adjusted_rand_score
evidence = []
for count, methods in ((2000, ('minibatch', 'agglomerative', 'hdbscan')), (20000, ('minibatch',))):
    features, truth = make_blobs(n_samples=count, n_features=32, centers=8, random_state=42)
    for method in methods:
        output = cluster({'method': method, 'normalize': False}, features)
        assert adjusted_rand_score(truth, output['labels']) > .95
        evidence.append({'method': method, 'records': count, 'dimensions': 32, 'seconds': output['seconds']})
json.dumps(evidence)
`));
assert.equal(timings.length, 4);
// Exercise the same JsProxy.to_py bridge as the browser worker.
python.globals.set('embedding_values', [[0, 0], [0, 1], [10, 10], [10, 11]]);
const result = JSON.parse(await python.runPythonAsync(`run_clustering('{"method":"minibatch","clusters":2,"normalize":false}')`));
assert.equal(result.labels[0], result.labels[1]);
assert.notEqual(result.labels[0], result.labels[2]);
const grouped = JSON.parse(await python.runPythonAsync(`
build_term_index(json.dumps({'indexId':'test', 'rows':4, 'sizes':[1,1], 'stopwords':[],
    'columns':[{'name':'text','texts':['camera sharp','camera good','battery flat','battery bad']}]}))
describe_groups(json.dumps({'indexId':'test','support':1,'ranking':'contrast','deduplicate':False,
    'groups':[{'id':'0','name':'Camera','subset':[0,1],'comparison':[2,3]},
              {'id':'1','name':'Battery','subset':[2,3],'comparison':[0,1]}]}))
`));
assert.equal(grouped.groups.length, 2);
assert.equal(grouped.groups[0].description.fields[0].terms[0].phrase, 'camera');
assert.equal(grouped.groups[1].description.fields[0].terms[0].phrase, 'battery');
const evidence = { runtime: 'Node / Pyodide 0.29.0 / scikit-learn 1.7.0 WASM', timings,
  bridge: 'passed', groupDescriptions: 'passed', browserUI: 'not run' };
await mkdir('.cache/checks', { recursive: true });
await writeFile(new URL('../.cache/checks/clustering-results.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
