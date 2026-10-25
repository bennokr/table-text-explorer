import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession } from './browser_session.mjs';

const session = await browserSession();
const { page } = session;
const snapshot = () => page.evaluate(() => window.explorer.snapshot());
const field = name => page.locator(`.term-field[data-field="${name}"]`);

async function select(ids) {
  await page.evaluate(ids => {
    const plot = Object.values(window.Bokeh.index).find(view => document.querySelector('#scatter').contains(view.el)).model;
    plot.renderers.find(renderer => renderer.data_source).data_source.selected.indices = ids;
  }, ids);
  await page.waitForFunction(ids => JSON.stringify(window.explorer.snapshot().selected) === JSON.stringify(ids), ids);
}

async function described(subset, comparison) {
  await page.waitForFunction(([subset, comparison]) =>
    document.querySelector('#terms-status').textContent.startsWith(`${subset} subset / ${comparison} comparison`)
    && !window.explorer.snapshot().busy, [subset, comparison], { timeout: 120000 });
}

async function build() {
  await page.click('#terms-build');
  await page.waitForFunction(() => !document.querySelector('#terms-index-controls').disabled
    && !window.explorer.snapshot().busy, null, { timeout: 120000 });
  assert.equal(await page.locator('#status').evaluate(node => node.classList.contains('error')), false,
    await page.locator('#status').textContent());
}

async function search(query) {
  await page.fill('#search', query);
  await page.press('#search', 'Enter');
  assert.notEqual(await page.locator('#search').getAttribute('aria-invalid'), 'true', await page.locator('#status').textContent());
}

async function synthetic() {
  const rows = Array.from({ length: 12 }, (_, id) => ({ id, score: id * id, group: id < 4 ? 'A' : 'B',
    positive: id < 4 ? `vriendelijk personeel ${id % 2 ? 'heerlijk ontbijt' : 'schone kamer'}` : 'mooi uitzicht',
    negative: id < 4 ? 'kleine badkamer' : 'lawaai buiten' }));
  await page.setInputFiles('#file', { name: 'terms.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(rows)) });
  await page.waitForFunction(() => window.explorer.snapshot().rows === 12);
  await page.selectOption('#projection', 'pca');
  assert.equal(await page.locator('.axis-controls').isVisible(), false);
  await page.click('#fit');
  await page.waitForFunction(() => window.explorer.snapshot().projection === 'pca');
  const projection = (await snapshot()).projections;
  await page.click('#show-terms');
  await page.locator('#terms-fields').locator('..').locator('summary').click();
  for (const input of await page.locator('#terms-fields input').all()) {
    await input.setChecked(['positive', 'negative'].includes(await input.inputValue()));
  }
  await select([0, 1, 2, 3]);
  await build();
  await described(4, 8);
  assert.equal(await page.locator('.term-field').count(), 2);
  await resultViews();
  const phrase = field('positive').locator('tr[data-term="vriendelijk personeel"]');
  assert.equal(await phrase.locator('td').nth(1).textContent(), '4 · 100%');
  assert.equal(await phrase.locator('td').nth(2).textContent(), '0 · 0%');
  assert.ok(await field('negative').locator('tr[data-term="kleine badkamer"]').count());
  assert.equal(await field('positive').locator('tr[data-term="kleine badkamer"]').count(), 0);
  await phrase.locator('button').click();
  await field('positive').getByRole('button', { name: 'Record 1', exact: true }).last().click();
  assert.deepEqual((await snapshot()).selected, [0, 1, 2, 3]);
  assert.equal((await snapshot()).active, 0);
  await field('positive').getByRole('button', { name: 'personeel heerlijk ontbijt', exact: true }).click();
  await field('positive').getByRole('button', { name: 'Highlight matches', exact: true }).click();
  await described(2, 10);
  assert.deepEqual((await snapshot()).selected, [1, 3]);
  await subsetChanges(projection);
  await reuseIndex();
  await cancelIndex();
}

async function resultViews() {
  const positive = field('positive');
  assert.equal(await positive.locator('tr[data-term="vriendelijk"]').count(), 0);
  await page.uncheck('#terms-deduplicate');
  await positive.locator('tr[data-term="vriendelijk"]').waitFor();
  await page.check('#terms-deduplicate');
  await page.waitForFunction(() => !document.querySelector('tr[data-term="vriendelijk"]'));
  await positive.getByRole('checkbox', { name: 'Inline view for positive' }).check();
  assert.equal(await positive.locator('.term-table').isVisible(), false);
  assert.equal(await field('negative').locator('.term-table').isVisible(), true);
  await positive.locator('.term-inline').getByRole('button', { name: 'vriendelijk personeel', exact: true }).click();
  assert.ok(await positive.getByRole('button', { name: 'Highlight matches' }).isVisible());
  await page.locator('#terms-settings > summary').click();
  assert.equal(await page.locator('#terms-build').isVisible(), false);
  assert.equal(await positive.locator('.term-inline').isVisible(), true);
  await select([1, 3]);
  await described(2, 10);
  assert.equal(await positive.locator('.term-inline').isVisible(), true);
  assert.equal(await page.locator('#terms-settings').getAttribute('open'), null);
  await page.screenshot({ path: '.cache/terms-compact.png' });
  await select([0, 1, 2, 3]);
  await described(4, 8);
  await positive.getByRole('checkbox', { name: 'Inline view for positive' }).uncheck();
  await page.locator('#terms-settings > summary').click();
}

async function layout() {
  await page.click('#show-charts');
  const header = page.locator('.explore-head');
  assert.equal(await header.locator('h2').count(), 0);
  const bounds = await header.boundingBox();
  const tabs = await page.locator('.view-tabs').boundingBox();
  const add = await page.locator('#add-chart').boundingBox();
  assert.ok(tabs.x - bounds.x < 10 && bounds.x + bounds.width - add.x - add.width < 10);
  await page.check('#compare');
  assert.equal(await page.locator('.projection-controls #projection').count(), 1);
  assert.equal(await page.locator('.projection-controls .axis-controls').count(), 1);
  await page.selectOption('#projection', 'axes');
  assert.equal(await page.locator('.axis-controls').isVisible(), true);
  await page.selectOption('#projection', 'umap');
  assert.equal(await page.locator('.axis-controls').isVisible(), false);
  await page.selectOption('#projection', 'axes');
  await page.uncheck('#compare');
  await page.click('#show-terms');
  assert.equal(await page.locator('#add-chart').isVisible(), false);
}

async function subsetChanges(projection) {
  await page.selectOption('#terms-ranking', 'lift');
  await search('group = "A"');
  await described(2, 2);
  await page.selectOption('#terms-scope', 'filtered');
  await described(4, 8);
  await page.fill('#terms-support', '5');
  await page.waitForFunction(() => document.querySelectorAll('.term-table').length === 0);
  await page.fill('#terms-support', '2');
  await page.waitForFunction(() => document.querySelectorAll('.term-table').length === 2);
  assert.deepEqual((await snapshot()).projections, projection);
}

async function reuseIndex() {
  await page.click('#clear-filters');
  await described(12, 0);
  assert.match(await page.locator('#terms-status').textContent(), /no comparison/);
  await page.selectOption('#terms-scope', 'selection');
  await page.click('#clear-selection');
  await page.waitForFunction(() => document.querySelector('#terms-status').textContent.startsWith('Highlight records'));
  await select([1, 3]);
  await described(2, 10);
  await page.click('#clear-selection');
  await page.waitForFunction(() => document.querySelector('#terms-status').textContent.startsWith('Highlight records'));
  await select([1, 3]);
  await described(2, 10);
  assert.ok(await page.locator('.term-table').count());
  await select([0, 1]);
  await select([4, 5]);
  await select([8, 9, 10, 11]);
  await described(4, 8);
  assert.ok(await field('positive').locator('tr[data-term="mooi uitzicht"]').count());
  await page.screenshot({ path: '.cache/terms-synthetic.png' });
  await page.selectOption('#projection', 'svd');
  await page.click('#fit');
  await page.waitForFunction(() => window.explorer.snapshot().projection === 'svd');
  await select([0, 1, 2]);
  await described(3, 9);
  assert.ok(await field('positive').locator('tr[data-term="vriendelijk personeel"]').count());
}

async function cancelIndex() {
  const projections = (await snapshot()).projections;
  await page.evaluate(() => {
    document.querySelector('#terms-form').requestSubmit();
    if (!document.querySelector('#fit .loading-glyph')) { throw new Error('Missing busy glyph'); }
    document.querySelector('#cancel').click();
  });
  await page.waitForFunction(() => !window.explorer.snapshot().busy && !document.querySelector('#fit').disabled);
  assert.equal(await page.locator('.term-field').count(), 0);
  assert.match(await page.locator('#terms-status').textContent(), /Build an n-gram index/);
  assert.equal(await page.locator('#fit').textContent(), '▶');
  assert.deepEqual((await snapshot()).projections, projections);
  await build();
  await described(3, 9);
}

async function example(name, rows, fields, query) {
  await page.selectOption('#examples', name);
  await page.waitForFunction(rows => window.explorer.snapshot().rows === rows, rows);
  await layout();
  assert.equal(await page.locator('.term-field').count(), 0);
  const checked = await page.locator('#terms-fields input:checked').evaluateAll(inputs => inputs.map(input => input.value));
  assert.deepEqual(checked, fields);
  await page.selectOption('#terms-scope', 'filtered');
  await page.selectOption('#terms-ranking', 'contrast');
  await search(query);
  await build();
  const visible = (await snapshot()).visible;
  assert.ok(visible > 1 && visible < rows);
  await described(visible, rows - visible);
  assert.equal(await page.locator('.term-field').count(), fields.length);
  assert.ok(await page.locator('.term-table tbody tr').count() > 0);
  await page.screenshot({ path: `.cache/terms-${name}.png` });
  return { rows, subset: visible, fields: fields.length };
}

try {
  await mkdir('.cache', { recursive: true });
  await synthetic();
  const bol = await example('bol-absa-preview.json', 1000, ['pros_text', 'cons_text'], 'pro_count > 1');
  const dbrd = await example('dbrd-test.json', 2224, ['text'], 'sentiment = "positive"');
  assert.deepEqual(session.errors, []);
  assert.ok(session.requests.every(request => request.local && request.method === 'GET'));
  const report = { synthetic: true, bol, dbrd, pageErrors: 0, externalRequests: 0, gpuDisabled: true };
  const destination = process.env.BROWSER_SERVER === 'dev' ? '.cache/dev-terms-results.json' : 'docs/evidence/terms-results.json';
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} catch (error) {
  console.error('Inspector:', await page.locator('#terms-status').textContent());
  console.error('Status:', await page.locator('#status').textContent());
  await page.screenshot({ path: '.cache/terms-failure.png' }).catch(() => {});
  throw error;
} finally { await session.close(); }
