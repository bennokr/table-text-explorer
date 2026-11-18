import { test, expect, snapshot } from './fixtures.mjs';

const nested = Array.from({ length: 12 }, (_, id) => ({ id, review: { title: `Title ${id}`,
  parts: [{ text: 'good battery' }, { text: `fast camera ${id}` }], stars: id % 5 } }));
const file = { name: 'nested.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(nested)) };

test('nested JSON asks before it is flattened and can be skipped or cancelled', async ({ app }) => {
  const { page } = app;
  await page.setInputFiles('#file', file);
  await expect(page.locator('#flatten-dialog')).toBeVisible();
  await expect(page.locator('#flatten-summary')).toContainText('12 records · 4 columns');
  await expect(page.locator('#flatten-dialog')).toContainText('not kept');
  await expect(page.locator('#flatten-columns tr').filter({ hasText: 'review.parts.text' })).toContainText('merged text');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#status')).toContainText('Import cancelled');
  expect((await snapshot(page)).rows).toBe(0);

  await page.setInputFiles('#file', file);
  await page.getByRole('button', { name: 'Flatten', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).rows).toBe(12);
  const state = await snapshot(page);
  expect(state.fields.map(field => field.name)).toEqual(['id', 'review.title', 'review.parts.text', 'review.stars']);

  await page.setInputFiles('#file', file);
  await page.getByRole('button', { name: 'Skip nested columns' }).click();
  await expect.poll(async () => (await snapshot(page)).fields.map(field => field.name)).toEqual(['id']);
});
