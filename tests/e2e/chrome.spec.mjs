import { test, expect, importRows, query } from './fixtures.mjs';

// Glyph rules: a gear opens a modal of settings, an ellipsis shows more controls inline.
test('chrome: the phrase settings gear is in the descriptions panel, the ellipsis is in its controls row', async ({ app }) => {
  const { page } = app;
  await importRows(page);
  await expect(page.locator('.topbar #phrase-settings'), 'the top bar has no phrase settings gear').toHaveCount(0);
  await expect(page.locator('#description-panel .panel-head #phrase-settings')).toBeVisible();
  await expect(page.locator('#description-panel .term-fields #terms-options')).toHaveText('⋯');
  await query(page, 'group:camera');
  await expect(page.locator('#terms-contrast')).toBeVisible();
  const size = await page.locator('#terms-ranking').boundingBox();
  const more = await page.locator('#terms-options').boundingBox();
  expect(Math.abs(more.y - size.y), 'the ellipsis ends the Size / Color / Contrast row').toBeLessThan(8);
  await page.click('#phrase-settings');
  await expect(page.locator('#phrase-dialog')).toBeVisible();
  await page.locator('#phrase-dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('#description-hint')).toHaveAttribute('data-help', 'descriptions#size-color-and-contrast');
  await expect(page.locator('#terms-empty, #terms-status').first()).toBeAttached();
});

test('chrome: Remove all charts can be undone, and the map card menu offers a new map', async ({ app }) => {
  const { page } = app;
  await importRows(page);
  const cards = page.locator('.view-card');
  const before = await cards.count();
  expect(before).toBeGreaterThan(1);
  await page.click('#clear-views');
  await expect(cards).toHaveCount(0);
  await expect(page.locator('#status')).toContainText(`Removed ${before} charts.`);
  await page.locator('#status .link').click();
  await expect(cards).toHaveCount(before);
  await expect(page.locator('#status .link')).toHaveCount(0);
});

test('chrome: the help dialog has a Home button and a square close button', async ({ app }) => {
  const { page } = app;
  await page.click('#help');
  await expect(page.locator('#help-title')).toHaveText('Help');
  await page.selectOption('#help-topic', 'maps');
  await expect(page.locator('#help-title')).not.toHaveText('Help');
  await page.click('#help-home');
  await expect(page.locator('#help-title')).toHaveText('Help');
  const box = await page.locator('#help-dialog [data-close]').boundingBox();
  expect(Math.round(box.width), 'the close button is square').toBe(Math.round(box.height));
  await page.locator('#help-dialog [data-close]').click();
  await expect(page.locator('#help-dialog')).not.toBeVisible();
});
