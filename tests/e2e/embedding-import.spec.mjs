import { test, expect, importRows, snapshot, idle, mapForm, finishMap } from './fixtures.mjs';

// Two clearly separated groups of unit vectors, one per record, in table order.
function vectors(count = 24) {
  const values = new Float32Array(count * 4);
  for (let id = 0; id < count; id += 1) {
    const base = id < count / 2 ? [1, 0.1, 0, 0] : [0, 0, 1, 0.1];
    base.forEach((value, index) => { values[id * 4 + index] = value + 0.01 * ((id * 7 + index) % 5); });
  }
  return values;
}

test('embeddings: imported vectors make a map without loading a sentence model, and wrong files are refused', async ({ app }) => {
  const { page, models } = app;
  await importRows(page);
  await mapForm(page, 'sentences');
  const file = page.locator('#embedding-file');

  await file.setInputFiles({ name: 'short.f32', mimeType: 'application/octet-stream', buffer: Buffer.from(vectors(10).buffer) });
  await expect(page.locator('#map-error')).toContainText(/whole number of values|table has 24 records/);
  await expect(page.locator('#sentence-model option')).toHaveCount(2);

  await file.setInputFiles({ name: 'motions.f32', mimeType: 'application/octet-stream', buffer: Buffer.from(vectors().buffer) });
  await expect(page.locator('#map-error')).toHaveText('');
  await expect(page.locator('#sentence-model option:checked')).toHaveText('Imported · motions.f32 · 4-d');
  await expect(page.locator('#sentence-chunking')).toBeDisabled();

  await finishMap(page);
  await idle(page);
  expect((await snapshot(page)).coordinates.length).toBeGreaterThan(0);
  expect(models, 'imported vectors need no sentence model').toEqual([]);

  await page.click('#export');
  await expect(page.getByRole('button', { name: 'Download embeddings (.npy)' })).toBeVisible();
});
