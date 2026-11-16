import { test, expect, importRows, snapshot } from './fixtures.mjs';

const rows = Array.from({ length: 60 }, (_, id) => ({ id, year: [2023, 2017, 2024, 2024, 2023, 2024][id % 6],
  group: id % 3 ? 'battery' : 'camera', score: id }));

async function pick(card, label, text) {
  const picker = card.locator(`variable-picker[aria-label="${label}"]`);
  await picker.getByRole('button', { name: label, exact: true }).click();
  await picker.locator('.vp-option', { hasText: text }).first().click();
}

// A year chart reads 2017, 2023, 2024 from the top; a Color column cuts its bars into segments and lists its key;
// a histogram's bin count is set in the card's ⋯ menu.
test('charts: years in order, stacked bars with a color key, and a bin count for histograms', async ({ app }) => {
  const { page } = app;
  await importRows(page, rows);
  const bars = page.locator('.view-card').first();
  await bars.locator('select.view-type').selectOption('bar');
  await pick(bars, 'X column', 'year');
  await expect(bars.locator('.bk-events').first()).toBeVisible();
  await expect.poll(() => snapshot(page).then(state => state.rows)).toBe(60);

  await pick(bars, 'Color by', 'group');
  await expect(bars.locator('.color-key .legend-value')).toHaveCount(2);
  const dots = await bars.locator('.color-key .chip-dot').evaluateAll(nodes => nodes.map(node => node.style.background));
  expect(new Set(dots).size).toBe(2);

  const histogram = page.locator('.view-card').nth(1);
  await histogram.locator('select.view-type').selectOption('histogram');
  await pick(histogram, 'X column', 'score');
  await histogram.getByRole('button', { name: 'Chart options' }).click();
  await expect(histogram.getByLabel('Histogram bins')).toBeVisible();
  await histogram.getByLabel('Histogram bins').fill('7');
  await histogram.getByLabel('Histogram bins').press('Enter');
  await expect(bars.getByLabel('Histogram bins')).toBeHidden();
});
