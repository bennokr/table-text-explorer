import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { browserSession } from './browser_session.mjs';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const session = await browserSession();
const { page } = session;
const results = [];
const snapshot = () => page.evaluate(() => window.explorer.snapshot());

async function example(name, rows) {
  await page.waitForFunction(() => document.querySelector('#examples').options.length > 1);
  await page.selectOption('#examples', name);
  await page.waitForFunction(({ name, rows }) => document.querySelector('#dataset-name').textContent === name
    && window.explorer.snapshot().rows === rows, { name, rows });
  await page.locator('#scatter .bk-events').waitFor();
  assert.equal(await page.locator('#record-body .record-field').count(), (await snapshot()).fields.length);
  assert.ok((await snapshot()).fields.some(field => field.kind === 'categorical'));
  results.push({ fixture: name, rows, fields: (await snapshot()).fields.length });
}

async function brush() {
  await page.click('#clear-selection');
  const events = page.locator('#scatter .bk-events');
  const box = await events.boundingBox();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.85, { steps: 16 });
  await page.mouse.up();
  await page.waitForFunction(() => window.explorer.snapshot().selected.length > 0);
  const highlighted = await snapshot();
  assert.equal(highlighted.visible, highlighted.rows);
  await page.click('#filter-selection');
  assert.equal((await snapshot()).visible, highlighted.selected.length);
  await page.click('#clear-filters');
  assert.equal((await snapshot()).visible, highlighted.rows);
  assert.deepEqual((await snapshot()).coordinates, highlighted.coordinates);
}

async function charts() {
  const fields = (await snapshot()).fields;
  const numbers = fields.filter(field => field.kind === 'number');
  const categories = fields.filter(field => field.kind === 'categorical');
  const initial = await page.locator('.chart-card').count();
  for (const pair of [[numbers[0], numbers[1]], [categories[0], numbers[0]],
    [categories[0], categories[1]]]) {
    if (pair.some(field => !field)) { continue; }
    await page.click('#add-chart');
    await page.selectOption('#chart-x', pair[0].name);
    await page.selectOption('#chart-y', pair[1].name);
    await page.locator('#chart-form button[type=submit]').click();
    await page.locator('.chart-card').last().locator('.bk-events').waitFor();
  }
  assert.ok(await page.locator('.chart-card').count() > initial);
  const before = await page.locator('.chart-card').count();
  await page.getByRole('button', { name: 'Remove chart', exact: true }).last().click();
  assert.equal(await page.locator('.chart-card').count(), before - 1);
}

async function aggregateSelection() {
  await page.click('#clear-selection');
  const point = await page.evaluate(() => {
    const container = document.querySelector('.chart-plot');
    const view = Object.values(window.Bokeh.index).find(view => container.contains(view.el));
    const data = view.model.renderers.find(renderer => renderer.data_source?.data.count).data_source.data;
    const rectangle = view.canvas_view.events_el.getBoundingClientRect();
    return { x: rectangle.x + view.frame.x_scale.compute(data.count[0] / 2),
      y: rectangle.y + view.frame.y_scale.compute(data.y[0]), expected: data.count[0] };
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => window.explorer.snapshot().selected.length > 0);
  assert.equal((await snapshot()).selected.length, point.expected);
  assert.equal((await snapshot()).visible, 987);
}

async function search() {
  await page.fill('#search', 'rowNumber>=10 AND rowNumber<=15');
  await page.press('#search', 'Enter');
  assert.equal((await snapshot()).visible, 6);
  await page.fill('#search', '(rowNumber>=10 AND');
  await page.press('#search', 'Enter');
  assert.equal(await page.locator('#search').getAttribute('aria-invalid'), 'true');
  assert.equal((await snapshot()).visible, 6);
  await page.click('#clear-filters');
}

function exportedRows(bytes, format) {
  if (format === 'json') { return JSON.parse(bytes.toString()); }
  if (format === 'csv') { return Papa.parse(bytes.toString(), { header: true }).data; }
  const book = XLSX.read(bytes);
  return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: null });
}

async function annotationExport() {
  await page.locator('.data-table tbody tr[data-id]').first().click();
  const selected = (await snapshot()).selected[0];
  page.once('dialog', dialog => dialog.accept('review'));
  await page.click('#new-annotation');
  await page.fill('#annotation-value', 'Checked');
  await page.click('#assign');
  for (const format of ['json', 'csv', 'xlsx']) {
    await page.click('#export');
    await page.selectOption('#export-format', format);
    const pending = page.waitForEvent('download');
    await page.locator('#export-form button[type=submit]').click();
    const download = await pending;
    const path = `.cache/v01-export.${format}`;
    await download.saveAs(path);
    const rows = exportedRows(await readFile(path), format);
    assert.equal(rows.length, 987);
    assert.equal(rows[selected].review, 'Checked');
    assert.ok(Object.hasOwn(rows[0], 'rowNumber'));
  }
}

async function typeOverride() {
  const before = await snapshot();
  const category = before.fields.find(field => field.kind === 'categorical');
  await page.click('#settings');
  await page.getByLabel(`Type of ${category.name}`, { exact: true }).selectOption('number');
  await page.locator('#settings-form button[type=submit]').click();
  const after = await snapshot();
  assert.equal(after.fields.find(field => field.name === category.name).kind, 'number');
  assert.deepEqual(after.coordinates, before.coordinates);
  assert.equal(after.projection, before.projection);
}

async function fit(method, expectedRows) {
  await page.selectOption('#projection', method);
  await page.click('#fit');
  await page.waitForFunction(method => window.explorer.snapshot().projection === method
    && !window.explorer.snapshot().busy, method, { timeout: 180000 });
  const result = await snapshot();
  assert.equal(result.fittedRows, expectedRows);
  assert.ok(result.coordinates.every(Number.isFinite));
  results.push({ method, rows: result.fittedRows, visible: result.visible });
}

async function textProjection() {
  await page.click('#settings');
  await page.selectOption('#feature-mode', 'text');
  const checkboxes = page.locator('#feature-list input[type=checkbox]');
  assert.ok(await checkboxes.count() > 1);
  for (const input of await checkboxes.all()) { await input.check(); }
  await page.locator('#settings-form button[type=submit]').click();
  await fit('svd', 20);
  await fit('umap', 20);
}

async function syntheticImport() {
  const rows = Array.from({ length: 1200 }, (_, id) => ({ id, x: id % 37,
    y: id % 53, group: id % 3, note: `Synthetic row ${id}\nSecond line` }));
  await page.setInputFiles('#file', { name: 'synthetic.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(rows)) });
  await page.waitForFunction(() => window.explorer.snapshot().rows === 1200);
  assert.ok(await page.locator('.data-table tbody tr[data-id]').count() < 100);
  await page.locator('#table-scroll').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await page.locator('.data-table tbody tr[data-id="1199"]').waitFor();
  await page.locator('.data-table tbody tr[data-id="1199"]').click();
  assert.equal((await snapshot()).active, 1199);
  assert.ok((await page.locator('#record-body').textContent()).includes('Second line'));
}

try {
  await mkdir('.cache', { recursive: true });
  assert.equal(await page.locator('.workspace > .panel').count(), 4);
  await example('uefa_players.csv', 987);
  await brush();
  await aggregateSelection();
  await charts();
  await search();
  await annotationExport();
  await page.screenshot({ path: '.cache/v0.1-csv.png' });
  await example('survey.sav', 439);
  await page.fill('#search', 'SEX=1');
  await page.press('#search', 'Enter');
  assert.ok((await snapshot()).visible > 0 && (await snapshot()).visible < 439);
  await fit('pca', 439);
  assert.ok((await snapshot()).visible < 439);
  await typeOverride();
  const coordinates = (await snapshot()).coordinates;
  await page.click('#clear-filters');
  assert.deepEqual((await snapshot()).coordinates, coordinates);
  await fit('umap', 439);
  await page.click('#fit');
  await page.click('#cancel');
  await page.waitForFunction(() => !window.explorer.snapshot().busy);
  assert.equal((await snapshot()).projection, 'umap');
  await example('RMC_synthetische_data_20_rijen.xlsx', 20);
  assert.ok(await page.locator('#table-scroll').evaluate(node => node.scrollWidth > node.clientWidth));
  assert.ok(await page.locator('#record-body').evaluate(node => node.scrollHeight > node.clientHeight));
  await textProjection();
  await page.screenshot({ path: '.cache/v0.1-xlsx.png' });
  await syntheticImport();
  await example('uefa_players.csv', 987);
  assert.ok(await page.locator('.data-table tbody tr[data-id="0"]').count());
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForFunction(() => document.querySelector('#charts').scrollHeight > document.querySelector('#charts').clientHeight);
  await page.screenshot({ path: '.cache/v0.1-overview.png' });
  assert.deepEqual(session.errors, []);
  assert.ok(session.requests.every(request => request.local && request.method === 'GET'));
  const report = process.env.BROWSER_SERVER === 'dev' ? '.cache/dev-results.json' : 'docs/v0.1-results.json';
  await writeFile(report, JSON.stringify({ results, pageErrors: session.errors,
    requests: session.requests.length, externalRequests: 0, gpuDisabled: true }, null, 2));
  console.log('v0.1 checks passed:', JSON.stringify(results));
} catch (error) {
  console.error('Application status:', await page.locator('#status').textContent());
  await page.screenshot({ path: '.cache/v0.1-failure.png' }).catch(() => {});
  throw error;
} finally { await session.close(); }
