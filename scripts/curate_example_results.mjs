// Draws the precomputed map and clustering of a curated example by running the app itself: a UMAP fit on the
// example's shipped embeddings and a k-means clustering of that map, read back through the Exports dialog.
// The draft goes to demo-config/<example>/results.json with the app's automatic cluster names; the names are
// then edited by hand in that file, which this script will not overwrite without --force.
//
//   npm run build && node node_modules/vite/bin/vite.js preview --port 4180 &
//   node scripts/curate_example_results.mjs dbrd-test.json 8
//
// BASE_URL and CHROMIUM_PATH override the address and the browser. Nothing leaves this machine.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const [, , example, clusters = '8', ...flags] = process.argv;
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4180/';
const target = `demo-config/${example}/results.json`;

if (!example) { throw new Error('Usage: node scripts/curate_example_results.mjs <example table name> [clusters] [--force]'); }
if (!flags.includes('--force') && await access(target).then(() => true, () => false)) {
  throw new Error(`${target} exists and may hold hand-edited names; pass --force to replace it.`);
}

const round = value => (Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null);

async function waitIdle(page, timeout) {
  await page.waitForFunction(() => !window.explorer.snapshot().analysisBusy, null, { timeout });
}

// The Exports dialog's JSON for the saved result whose entry mentions `text`.
async function downloadResult(page, text) {
  await page.click('#export');
  const entry = page.locator('.saved-result', { hasText: text }).first();
  const [download] = await Promise.all([page.waitForEvent('download'), entry.getByRole('button', { name: 'Download JSON' }).click()]);
  const json = JSON.parse(await readFile(await download.path(), 'utf8'));
  await page.keyboard.press('Escape');
  return json;
}

function ordered(records, rowIds, values) {
  const result = new Array(records).fill(null);
  rowIds.forEach((id, index) => { result[id] = values[index]; });
  return result;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
page.on('pageerror', error => { throw error; });
await page.goto(base);
await page.selectOption('#examples', example);
await page.waitForFunction(() => window.explorer.snapshot().rows > 0, null, { timeout: 120000 });
const records = (await page.evaluate(() => window.explorer.snapshot())).rows;

await page.click('#analysis-inputs');
await page.selectOption('#map-method', 'umap');
const settings = await page.evaluate(() => ({ neighbors: Number(document.querySelector('#neighbors')?.value), epochs: Number(document.querySelector('#epochs')?.value) }));
await page.click('#map-submit');
await page.locator('.view-card .bk-events').first().waitFor({ timeout: 900000 });
await waitIdle(page, 900000);
const map = await downloadResult(page, 'Similarity map');

await page.click('#add-chart');
await page.click('#cluster');
await page.fill('#cluster-count', clusters);
await page.click('#cluster-submit');
await page.locator('.cluster-legend').last().waitFor({ timeout: 300000 });
await waitIdle(page, 300000);
const clustering = await downloadResult(page, 'clustering');
await browser.close();

const mapRows = map.coordinates.map(pair => pair);
const labelRows = ordered(records, clustering.rowIds, clustering.labels);
const draft = {
  version: 1,
  table: example,
  records,
  provenance: {
    map: `UMAP (umap-js 1.4.0, fixed seed) fitted by this app on the example's shipped embeddings; ${map.rowIds.length} of ${records} records have a point`,
    clustering: `k-means, ${clusters} clusters, fitted by this app on the saved feature space (the shipped embeddings reduced by SVD), not on the 2-D map`,
    parameters: { neighbors: settings.neighbors, epochs: settings.epochs },
    names: 'Cluster names were suggested by the app from each cluster\'s phrases and then edited by hand.',
    generated: new Date().toISOString().slice(0, 10),
  },
  map: { name: 'UMAP', method: 'umap', x: ordered(records, map.rowIds, mapRows.map(pair => round(pair[0]))),
    y: ordered(records, map.rowIds, mapRows.map(pair => round(pair[1]))) },
  clustering: { name: 'themes', method: 'kmeans', parameters: { clusters: Number(clusters) }, labels: labelRows,
    groups: Object.fromEntries(Object.entries(clustering.groups).map(([id, group]) => [id, { name: group.name }])) },
};
// Readable to edit by hand: objects indented, the long number arrays on one line each.
const text = JSON.stringify(draft, null, 2).replace(/\[([^[\]{}]*)\]/gu, (_, inner) => `[${inner.replace(/\s*\n\s*/gu, ' ').trim()}]`);
await mkdir(`demo-config/${example}`, { recursive: true });
await writeFile(target, `${text}\n`);
console.log(`${target}: ${records} records, ${map.rowIds.length} map points, ${Object.keys(draft.clustering.groups).length} clusters`);
