import { test, expect, snapshot, idle, finishMap } from './fixtures.mjs';

// The example embeddings are restored from the data release when the site is built; a build without it has none.
test('example embeddings: an example ships its embeddings, and the map form starts from them without loading a model', async ({ app, baseURL }) => {
  const { page, models } = app;
  const shipped = await page.request.get(`${baseURL}/fixtures/dbrd-test.text.dutch-minilm.npy`);
  test.skip(!shipped.ok() || (shipped.headers()['content-type'] ?? '').includes('html'), 'this build has no data release');

  await page.selectOption('#examples', 'dbrd-test.json');
  await expect.poll(async () => (await snapshot(page)).rows, { timeout: 60000 }).toBe(2224);
  await page.click('#analysis-inputs');
  await expect(page.locator('#feature-mode')).toHaveValue('sentences');
  await expect(page.locator('#sentence-model option:checked')).toHaveText(/Imported · text \(dutch\) · 384-d/);
  await page.selectOption('#map-method', 'linear');
  await finishMap(page);
  await idle(page);
  expect((await snapshot(page)).coordinates.length).toBeGreaterThan(0);
  expect(models, 'precomputed embeddings need no sentence model').toEqual([]);
});
