import { readFile } from 'node:fs/promises';
import { test, expect, importRows, query, snapshot } from './fixtures.mjs';

async function brush(page) {
  const box = await page.locator('[data-point-index="0"] .bk-events').boundingBox();
  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.8, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await snapshot(page)).selected.length).toBeGreaterThan(0);
}

async function filterBrush(page) {
  await brush(page);
  const selected = (await snapshot(page)).selected;
  await page.click('#filter-selection');
  expect((await snapshot(page)).visible).toBe(selected.length);
  expect((await snapshot(page)).selected).toEqual([]);
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '');
  await page.click('#clear-filters');
}

async function annotateExport(page, testInfo) {
  page.once('dialog', dialog => dialog.accept('review'));
  await page.click('#new-annotation');
  await page.fill('#annotation-value', 'Checked');
  await page.click('#assign');
  const ids = (await snapshot(page)).selected;
  const color = page.locator('[data-point-index="0"]').locator('variable-picker[aria-label="Color by"]');
  await color.getByRole('button', { name: 'Color by', exact: true }).click();
  await color.getByRole('searchbox').fill('review');
  await expect(color.locator('.vp-option')).toContainText(`${ids.length} non-missing`);
  await color.getByRole('searchbox').press('Escape');
  await page.click('#export');
  await expect(page.getByRole('heading', { name: 'Exports', exact: true })).toBeVisible();
  await expect(page.locator('#results')).toHaveCount(0);
  await expect(page.locator('#results-dialog')).toHaveCount(0);
  await expect(page.locator('#results-list')).toContainText('Make a similarity map');
  await page.selectOption('#export-format', 'json');
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-form button[type=submit]').click();
  const file = testInfo.outputPath('annotated.json');
  await (await downloaded).saveAs(file);
  const rows = JSON.parse(await readFile(file, 'utf8'));
  expect(rows).toHaveLength(24);
  expect(ids.every(id => rows[id].review === 'Checked')).toBe(true);
}

test('workspace: query highlight, explicit filter, linked brushing, cards and annotation export', async ({ app }, testInfo) => {
  const { page, models } = app;
  await importRows(page, undefined, true);
  await page.click('#add-chart'); // The default cards are bars and a histogram; brushing needs a scatter.
  await query(page, 'group:camera');
  expect((await snapshot(page)).visible).toBe(24);
  expect((await snapshot(page)).selected).toHaveLength(12);
  await page.click('#filter-selection');
  expect((await snapshot(page)).visible).toBe(12);
  expect((await snapshot(page)).selected).toEqual([]);
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '');
  await query(page, '(camera AND');
  await expect(page.locator('#search')).toHaveAttribute('aria-invalid', 'true');
  expect((await snapshot(page)).visible).toBe(12);
  await page.click('#clear-filters');
  await query(page, '');
  await filterBrush(page);
  await query(page, 'group:camera');
  await filterBrush(page);
  await brush(page);
  await page.check('#preview-selection');
  await expect(page.locator('#table-count')).toHaveText(`${(await snapshot(page)).selected.length} shown`);
  await page.uncheck('#preview-selection');
  const card = page.locator('[data-point-index="0"]');
  await card.getByRole('button', { name: 'View options', exact: true }).click();
  await card.getByLabel('View name', { exact: true }).fill('My scatter');
  await card.getByLabel('View name', { exact: true }).press('Tab');
  await expect(card.getByLabel('Chart type', { exact: true })).toHaveAttribute('title', /My scatter/);
  await card.getByRole('button', { name: 'Expand or restore view' }).click();
  await expect(card.getByRole('button', { name: 'Expand or restore view' })).toHaveText('•');
  await card.getByRole('button', { name: 'Expand or restore view' }).click();
  await annotateExport(page, testInfo);
  expect(models).toEqual([]);
  await expect(page.locator('footer #runtime-status')).toBeVisible();
});
