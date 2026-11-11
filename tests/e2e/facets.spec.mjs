import { test, expect, importRows, snapshot } from './fixtures.mjs';

test('facets: numeric-only tables describe missingness and ranges; clicks highlight before filtering', async ({ app }) => {
  test.setTimeout(150000);
  const { page, models } = app;
  await importRows(page, Array.from({ length: 24 }, (_, id) => ({ id, score: id,
    active: id < 12 ? true : null })));
  await expect(page.locator('#terms-options')).toBeEnabled();
  if (await page.locator('#terms-options').getAttribute('aria-expanded') === 'false') { await page.locator('#terms-options').click(); }
  await page.selectOption('#terms-content', 'facets');
  await page.selectOption('#terms-display', 'combined');
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]')).toHaveCount(1, { timeout: 120000 });
  await expect(page.locator('#terms-results .term-field-legend span')).toHaveText(['score', 'active']);
  await page.locator('.term-cloud text[data-term="Missing"][data-field="active"]').click();
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '"active"=null');
  await expect.poll(async () => (await snapshot(page)).selected.length).toBe(12);
  expect((await snapshot(page)).visible).toBe(24);
  await expect(page.locator('#terms-status')).toHaveText(/12 subset \/ 12 comparison/);
  await page.getByLabel('Cloud view for Metadata facets', { exact: true }).uncheck();
  await expect(page.locator('.term-table thead')).toContainText('Precision');
  await page.click('#filter-selection');
  await expect.poll(async () => (await snapshot(page)).visible).toBe(12);
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '');
  expect((await snapshot(page)).selected).toEqual([]);
  await page.selectOption('#terms-ranking', 'balanced');
  const range = page.locator('.term-table tbody button').first();
  await range.click();
  await expect(page.locator('#search-box')).not.toHaveAttribute('data-query', '');
  await page.click('#clear-selection');
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '');
  expect((await snapshot(page)).selected).toEqual([]);
  expect((await snapshot(page)).visible).toBe(12);
  await page.click('#clear-filters');
  await page.selectOption('#terms-compare', 'population:all');
  await page.selectOption('#terms-ranking', 'balanced');
  await expect(page.locator('#description-kind')).toHaveText('Even splits');
  await expect(page.locator('#terms-status')).toHaveText(/24 subset \/ 0 comparison/);
  expect(models).toEqual([]);
});
