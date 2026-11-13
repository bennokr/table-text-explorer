import { test, expect, snapshot } from './fixtures.mjs';

// The curated examples ship a UMAP map and a clustering with the app's automatic names (demo-config/<table>/results.json).
test('example results: a curated example opens with its map, legend and colored cloud, and fits nothing', async ({ app }) => {
  const { page, models } = app;
  await page.selectOption('#examples', 'dbrd-test.json');
  await expect.poll(async () => (await snapshot(page)).views.slice(0, 2).map(view => view.type), { timeout: 60000 }).toEqual(['map', 'legend']);
  await expect(page.locator('#status')).toContainText('precomputed UMAP map', { timeout: 30000 });
  const names = await page.locator('.cluster-legend input.cluster-name').evaluateAll(inputs => inputs.map(input => input.value));
  expect(names).toHaveLength(8);
  expect(names.every(name => name && !name.startsWith('#')), 'every cluster is named').toBe(true);
  await expect(page.locator('#terms-color option').first()).toHaveText(/Auto → themes · name/, { timeout: 90000 });
  await expect(page.locator('#terms-results .color-key .legend-value')).toHaveCount(8);
  expect(models, 'nothing was encoded or fitted').toEqual([]);
});

// The example's shipped embeddings are a Size entry of their own, so semantic splits work on a freshly opened example.
test('example results: semantic splits use the shipped embeddings and are tinted by the clusters', async ({ app }) => {
  const { page, models } = app;
  await page.selectOption('#examples', 'dbrd-test.json');
  await expect(page.locator('#status')).toContainText('precomputed UMAP map', { timeout: 60000 });
  const entry = page.locator('#terms-ranking option[value^="semantic:import"]');
  await expect(entry).toHaveCount(1);
  await expect(entry).toHaveText(/^Semantic splits · Imported · text \(dutch\)/);
  await page.selectOption('#terms-ranking', await entry.getAttribute('value'));
  await expect(page.locator('#description-kind')).toHaveText('Semantic splits by themes · name', { timeout: 90000 });
  await expect(page.locator('#terms-results .color-key .legend-value')).toHaveCount(8);
  expect(models).toEqual([]);
});
