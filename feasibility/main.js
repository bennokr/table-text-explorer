import { checkImports } from './imports.js';
import { checkPlots } from './plots.js';
import { checkSavParity } from './sav-parity.js';

const report = {};
window.feasibility = report;

function display() {
  document.querySelector('#report').textContent = JSON.stringify(report, null, 2);
}

function runWorker(worker, data) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Worker timed out')); },
      240000);
    worker.onmessage = ({ data: response }) => {
      clearTimeout(timeout);
      worker.terminate();
      if (response.error) { reject(new Error(response.error)); }
      else { resolve(response.result); }
    };
    worker.onerror = event => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(event.message));
    };
    worker.postMessage(data);
  });
}

async function probe(name, action) {
  const started = performance.now();
  report[name] = { status: 'running' };
  display();
  try { report[name] = { status: 'passed', ...await action(),
    wallSeconds: (performance.now() - started) / 1000 }; }
  catch (error) { report[name] = { status: 'failed', error: String(error.stack ?? error) }; }
  display();
}

async function baseline() {
  let texts;
  await probe('imports', async () => {
    const imported = await checkImports();
    texts = imported.texts;
    return imported.result;
  });
  await probe('plots', checkPlots);
  await probe('savParity', checkSavParity);
  await probe('analysis', () => runWorker(
    new Worker(new URL('./analysis.worker.js', import.meta.url), { type: 'module' }),
    { texts, stopwords: ['de', 'het', 'een', 'en', 'van', 'ik'] }));
  for (const rows of [1000, 20000]) {
    await probe(`umap${rows}`, () => runWorker(
      new Worker(new URL('./umap.worker.js', import.meta.url), { type: 'module' }), { rows }));
  }
  report.complete = true;
  display();
}

document.querySelector('#run').onclick = baseline;
document.querySelector('#embed').onclick = () => probe('embeddings', () => runWorker(
  new Worker(new URL('./embeddings.worker.js', import.meta.url), { type: 'module' }),
  { texts: ['De patiënt heeft pijn in de rug.', 'De patiënt heeft rugpijn.',
    'De voetballer scoort een doelpunt.', 'The patient has back pain.'] }));
