import { test, expect, snapshot, importRows, records } from './fixtures.mjs';

async function expectCards(page, count) {
  await expect(page.locator('.view-card')).toHaveCount(count);
  expect((await snapshot(page)).views).toHaveLength(count);
  const cards = await page.locator('.view-card').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.viewId, type: node.querySelector('.view-type').value,
    x: node.querySelector('variable-picker[aria-label="X column"]').selected[0] ?? '',
  })));
  expect(cards).toEqual((await snapshot(page)).views.map(({ id, type, x }) => ({ id, type, x })));
}

async function removeCards(page, initial = 3) {
  for (let count = initial - 1; count >= 0; count -= 1) {
    const card = page.locator('.view-card').first();
    await card.getByRole('button', { name: 'View options', exact: true }).click();
    await card.getByRole('button', { name: 'Remove visualization', exact: true }).click();
    await expectCards(page, count);
  }
  await expect(page.locator('#views-empty')).toBeVisible();
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator('.view-card')).toHaveCount(0);
}

async function replaceExpandedDataset(page) {
  await importRows(page);
  for (let index = 0; index < 3; index += 1) { await page.click('#add-chart'); }
  await expect(page.locator('.view-card')).toHaveCount(6);
  await page.locator('.view-card').first().getByRole('button', { name: 'Expand or restore view' }).click();
  await expect(page.locator('.view-card:visible')).toHaveCount(1);
  await page.selectOption('#examples', 'dbrd-test.json');
  await expect.poll(async () => (await snapshot(page)).rows).toBe(2224);
  // The example's own map and legend (precomputed) come first, then its three views.
  await expectCards(page, 5);
  await expect(page.locator('.view-card:visible')).toHaveCount(5);
}

async function shorterDemo(page) {
  // Exercise obsolete-card cleanup without depending on a private demo fixture.
  await page.route('**/demos/dbrd-test.json/demo.json', route => route.fulfill({ json: {
    version: 1, analysis: { mode: 'words', features: ['text'], language: 'nl' },
    views: [{ type: 'bar', x: 'sentiment' }, { type: 'histogram', x: 'word_count' }],
  } }));
  await page.selectOption('#examples', 'dbrd-test.json');
  await expect.poll(async () => (await snapshot(page)).rows).toBe(2224);
  await expectCards(page, 4);
  await removeCards(page, 4);
}

test('demo codebooks and views replace previous cards completely and reset on ordinary import', async ({ app }) => {
  const { page, models } = app;
  await replaceExpandedDataset(page);
  const demo = await snapshot(page);
  expect(demo.fields.find(field => field.name === 'text').kind).toBe('text');
  expect(demo.views.map(view => view.x)).toEqual(['', '', 'word_count', 'sentiment', 'word_count']);
  await page.click('#analysis-inputs');
  // The demo starts from its precomputed embeddings when the build has them (data release), else from TF-IDF.
  await expect(page.locator('#feature-mode')).toHaveValue(/^(text|sentences)$/u);
  await page.locator('#map-dialog [data-close]').click();
  await removeCards(page, 5);
  // Rows without a text column go back to the table input; with text the default is TF-IDF.
  await importRows(page, records.map(row => ({ id: row.id, x: row.x, y: row.y, group: row.group })));
  await expectCards(page, 3);
  await page.click('#analysis-inputs');
  await expect(page.locator('#feature-mode')).toHaveValue('table');
  await page.locator('#map-dialog [data-close]').click();
  await shorterDemo(page);
  expect(models).toEqual([]);
});
