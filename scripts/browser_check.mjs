import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const origin = 'http://127.0.0.1:4173';
const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1',
  '--port', '4173', '--strictPort'], { stdio: 'pipe' });
let browser;
const requests = [];
const errors = [];

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if ((await fetch(origin)).ok) { return; } }
    catch { /* Wait until the owned server listens. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Preview server did not start');
}

async function launch() {
  const executablePath = process.env.CHROMIUM_PATH;
  browser = await chromium.launch({ executablePath, args: ['--disable-webgl', '--disable-webgl2',
    '--disable-gpu', '--disable-features=WebGPU'] });
  const context = await browser.newContext({ viewport: { width: 1200, height: 1100 },
    serviceWorkers: 'block' });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', { value: undefined });
  });
  await context.route('**/*', async route => {
    const request = route.request();
    const allowed = new URL(request.url()).origin === origin;
    requests.push({ method: request.method(), local: allowed,
      model: request.url().includes('/models/') });
    if (!allowed) { await route.abort(); }
    else { await route.continue(); }
  });
  const page = await context.newPage();
  page.on('pageerror', error => { errors.push(String(error)); console.error(String(error)); });
  return page;
}

async function brush(page) {
  const canvas = page.locator('#plots .bk-events').first();
  const box = await canvas.boundingBox();
  assert.ok(box, 'Canvas event layer exists');
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.65, { steps: 12 });
  await page.mouse.up();
  await page.waitForFunction(() => window.plotProbe().selected > 0);
  const highlight = await page.evaluate(() => window.plotProbe());
  assert.equal(highlight.visible, 20000, 'Brushing preserves visibility');
  assert.equal(highlight.histogram, highlight.selected, 'Aggregate follows selection');
  await page.click('#filter');
  const filtered = await page.evaluate(() => window.plotProbe());
  assert.equal(filtered.visible, highlight.selected, 'Filtering is explicit');
  assert.equal(filtered.rows, 20000, 'Original data is preserved');
  return { highlight, filtered };
}

function validate(report) {
  for (const [name, result] of Object.entries(report)) {
    if (name !== 'complete') { assert.equal(result.status, 'passed', `${name}: ${result.error}`); }
  }
  assert.deepEqual([report.imports.csv.rows, report.imports.sav.rows,
    report.imports.xlsx.rows], [987, 439, 20]);
  assert.ok(report.imports.annotatedRoundtrips);
  assert.ok(report.analysis.finite);
  assert.ok(report.umap20000.finite);
  for (const result of Object.values(report.savParity).filter(value => typeof value === 'object')) {
    assert.ok(result.columnsMatch && result.valuesMatch && result.labelsMatch
      && result.valueLabelsMatch && result.missingMatch, 'SAV matches ReadStat');
  }
  assert.ok(report.embeddings.related > report.embeddings.unrelated);
  assert.equal(report.plots.backend, 'canvas');
}

try {
  await waitForServer();
  const page = await launch();
  await page.goto(`${origin}/feasibility.html`);
  await page.waitForFunction(() => window.feasibility, null, { timeout: 10000 });
  await page.click('#run');
  await page.waitForFunction(() => window.feasibility?.complete, null, { timeout: 240000 });
  const beforeOptIn = requests.filter(request => request.model).length;
  assert.equal(beforeOptIn, 0, 'No model loaded without opt-in');
  console.log('Baseline:', JSON.stringify(await page.evaluate(() => window.feasibility)));
  const selection = await brush(page);
  await page.click('#embed');
  await page.waitForFunction(() => ['passed', 'failed'].includes(
    window.feasibility?.embeddings?.status), null, { timeout: 240000 });
  const report = await page.evaluate(() => window.feasibility);
  const result = { report, selection, errors, beforeOptIn,
    network: { requests: requests.length, external: requests.filter(request => !request.local),
      nonGet: requests.filter(request => request.method !== 'GET') } };
  await mkdir('docs', { recursive: true });
  await writeFile('docs/evidence/feasibility-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  validate(report);
  assert.deepEqual(errors, []);
  assert.deepEqual(result.network.external, []);
  assert.deepEqual(result.network.nonGet, []);
} finally {
  await browser?.close();
  server.kill();
}
