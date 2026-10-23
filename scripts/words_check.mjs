import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { browserSession } from './browser_session.mjs';

const session = await browserSession();
const { page } = session;
const snapshot = () => page.evaluate(() => window.explorer.snapshot());

async function fit(slot, method) {
  await page.selectOption(slot ? '#projection-secondary' : '#projection', method);
  await page.click(slot ? '#fit-secondary' : '#fit');
  await page.waitForFunction(() => !document.querySelector('#fit').disabled, null, { timeout: 240000 });
  assert.equal((await snapshot()).projections[slot]?.method, method, await page.locator('#status').textContent());
  assert.equal(await page.locator('#status').evaluate(node => node.classList.contains('error')), false);
  await page.locator(slot ? '#scatter-secondary .bk-events' : '#scatter .bk-events').waitFor();
  console.log(`Passed ${slot ? 'comparison' : 'primary'} ${method}`);
}

async function settings(combine, fields, language = 'en') {
  await page.click('#settings');
  await page.selectOption('#feature-mode', 'words');
  await page.selectOption('#vector-language', language);
  await page.selectOption('#field-combine', combine);
  for (const input of await page.locator('#feature-list input[type=checkbox]').all()) {
    await input.setChecked(fields.includes(await input.inputValue()));
  }
  await page.locator('#settings-form button[type=submit]').click();
}

async function linkedBrush(selector) {
  await page.click('#clear-selection');
  const box = await page.locator(`${selector} .bk-events`).boundingBox();
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.9, { steps: 16 });
  await page.mouse.up();
  await page.waitForFunction(() => window.explorer.snapshot().selected.length > 0);
  const data = await page.evaluate(() => ['#scatter', '#scatter-secondary'].map(selector => {
    const container = document.querySelector(selector);
    const plot = Object.values(window.Bokeh.index).find(view => container.contains(view.el)).model;
    return { selected: plot.renderers.find(renderer => renderer.data_source).data_source.selected.indices,
      axesHidden: [...plot.xaxis, ...plot.yaxis].every(axis => !axis.visible),
      hover: plot.toolbar.tools.find(tool => tool.type === 'HoverTool').tooltips };
  }));
  const selected = (await snapshot()).selected;
  for (const plot of data) {
    assert.deepEqual(plot.selected, selected);
    assert.ok(plot.axesHidden);
    assert.deepEqual(plot.hover, [['Row', '@row']]);
  }
  return selected.length;
}

async function dutchImport() {
  const rows = Array.from({ length: 12 }, (_, id) => ({ id,
    goed: id % 2 ? 'Vriendelijk personeel en een mooie kamer' : 'Goede locatie en lekker ontbijt',
    fout: id % 3 ? 'Veel lawaai en een vieze badkamer' : 'Het bed was slecht en de kamer klein' }));
  rows.push({ id: 12, goed: null, fout: '\\N' });
  await page.setInputFiles('#file', { name: 'dutch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(rows)) });
  await page.waitForFunction(() => window.explorer.snapshot().rows === 13);
  await settings('concat', ['goed', 'fout'], 'nl');
  await fit(0, 'svd');
  const result = (await snapshot()).projections[0];
  assert.equal(result.count, 12);
  assert.equal(result.dimensions, 600);
  assert.ok(result.coverage.every(field => field.matched > 0));
  assert.equal((await snapshot()).rows, 13);
}

try {
  await mkdir('.cache', { recursive: true });
  await page.evaluate(() => {
    window.taskEvents = [];
    const capture = () => {
      const bar = document.querySelector('#task-progress');
      if (!bar.hidden) { window.taskEvents.push({ message: document.querySelector('#status').textContent,
        determinate: bar.hasAttribute('value') }); }
    };
    new MutationObserver(capture).observe(document.querySelector('footer'), { subtree: true, childList: true, attributes: true });
  });
  await page.selectOption('#examples', 'crawlfeeds-booking.csv');
  await page.waitForFunction(() => window.explorer.snapshot().rows > 4000);
  const rows = (await snapshot()).rows;
  assert.ok(rows < 10000);
  await fit(0, 'pca');
  const primary = (await snapshot()).projections[0];
  assert.equal(primary.config.vectorLanguage, 'en');
  assert.equal(primary.dimensions, 300);
  assert.ok(primary.count > 2000 && primary.count < rows);
  await page.check('#compare');
  await fit(1, 'umap');
  assert.deepEqual((await snapshot()).projections[0], primary);
  for (const selector of ['#scatter', '#scatter-secondary']) { await linkedBrush(selector); }
  const selected = (await snapshot()).selected.length;
  assert.equal((await snapshot()).visible, rows);
  await page.click('#filter-selection');
  assert.equal((await snapshot()).visible, selected);
  assert.deepEqual((await snapshot()).projections[0], primary);
  await page.click('#clear-filters');
  await settings('concat', ['positive_review_text', 'negative_review_text']);
  await fit(1, 'pca');
  assert.equal((await snapshot()).projections[1].dimensions, 600);
  assert.deepEqual((await snapshot()).projections[0], primary);
  await settings('mean', ['negative_review_text']);
  await fit(1, 'svd');
  assert.deepEqual((await snapshot()).projections[1].config.features, ['negative_review_text']);
  assert.deepEqual((await snapshot()).projections[0], primary);
  await page.screenshot({ path: '.cache/word-comparison.png' });
  const tasks = await page.evaluate(() => window.taskEvents);
  for (const stage of ['Reading', 'Parsing', 'Embedding', 'Reducing', 'Fitting UMAP']) {
    assert.ok(tasks.some(task => task.message.includes(stage)), `Missing progress for ${stage}`);
  }
  assert.ok(tasks.some(task => task.determinate) && tasks.some(task => !task.determinate));
  await dutchImport();
  assert.deepEqual(session.errors, []);
  assert.ok(session.requests.every(request => request.local && request.method === 'GET'));
  const report = { rows, embedded: primary.count, dimensions: primary.dimensions,
    progressEvents: tasks.length, pageErrors: 0, externalRequests: 0, gpuDisabled: true };
  const destination = process.env.BROWSER_SERVER === 'dev' ? '.cache/dev-words-results.json' : 'docs/v0.2-results.json';
  await writeFile(destination, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} catch (error) {
  console.error('Status:', await page.locator('#status').textContent());
  await page.screenshot({ path: '.cache/words-failure.png' }).catch(() => {});
  throw error;
} finally { await session.close(); }
