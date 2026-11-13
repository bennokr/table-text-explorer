import { test, expect, snapshot } from './fixtures.mjs';

// The curated examples ship a UMAP map and a clustering with hand-edited names (demo-config/<table>/results.json).
test('example results: a curated example opens with its map, legend and coloured cloud, and fits nothing', async ({ app }) => {
  const { page, models } = app;
  await page.selectOption('#examples', 'dbrd-test.json');
  await expect.poll(async () => (await snapshot(page)).views.slice(0, 2).map(view => view.type), { timeout: 60000 }).toEqual(['map', 'legend']);
  await expect(page.locator('#status')).toContainText('precomputed UMAP map', { timeout: 30000 });
  const names = await page.locator('.cluster-legend input.cluster-name').evaluateAll(inputs => inputs.map(input => input.value));
  expect(names).toHaveLength(8);
  expect(names.every(name => name && !name.startsWith('#') && !name.includes(' · ')), 'the names are the curated ones').toBe(true);
  await expect(page.locator('#terms-compare option').first()).toHaveText(/Auto → themes · name/, { timeout: 90000 });
  await expect(page.locator('#terms-results .colour-key .legend-value')).toHaveCount(8);
  expect(models, 'nothing was encoded or fitted').toEqual([]);
});
