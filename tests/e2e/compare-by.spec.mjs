import { test, expect, importRows, snapshot, idle } from './fixtures.mjs';

const option = (page, value) => page.locator(`#terms-color option[value="${value}"]`);
const legend = page => page.locator('#terms-results .color-key');

// Text with group-specific words; `signal` is 40% missing at random, `mnar` is missing exactly where
// the text belongs to the first group, `noise` is unrelated.
function planted(count = 240) {
  let seed = 7;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const groups = ['alfa', 'beta', 'gamma'];
  return Array.from({ length: count }, (_, id) => {
    const group = Math.floor(next() * 3);
    const words = Array.from({ length: 20 + Math.floor(next() * 30) }, () => (next() < 0.3
      ? `${groups[group]}woord${Math.floor(next() * 10)}` : `gemeen${Math.floor(next() * 60)}`));
    return { id, text: words.join(' '), signal: id % 5 < 2 ? null : groups[group],
      mnar: group === 0 ? null : groups[group], noise: ['x', 'y', 'z'][Math.floor(next() * 3)] };
  });
}

test('color: the best column colors the cloud, clicking a value conditions, and a highlight re-screens', async ({ app }) => {
  const { page } = app;
  await page.selectOption('#examples', 'dbrd-test.json');
  await expect.poll(async () => (await snapshot(page)).rows, { timeout: 60000 }).toBe(2224);
  await expect(page.locator('#terms-color option').first()).toHaveText(/Auto → (rating|sentiment|themes)/, { timeout: 90000 });
  await expect(page.locator('#description-kind')).toHaveText(/^Distinctive phrases by (rating|sentiment|themes)/);
  await expect(page.locator('#terms-ranking option[value="auto"]'), 'Size says what Automatic chose').toHaveText('Auto → Distinctive phrases');
  await expect(page.locator('#terms-contrast'), 'Contrast matters only when no column splits the cloud').toBeHidden();
  await expect(legend(page).locator('strong'), 'the column name is in the select and the heading, not beside the chips').toHaveCount(0);
  await expect(legend(page).locator('.legend-value')).not.toHaveCount(0);
  await expect(option(page, 'col:sentiment')).toContainText('●');
  await expect(option(page, 'col:word_count'), 'length alone is not a finding').toContainText('○○○');
  await expect(page.locator('#terms-color optgroup[label="Text axes"]'), 'text axes are gone').toHaveCount(0);

  await page.selectOption('#terms-color', 'col:sentiment');
  await expect(legend(page)).toContainText('negative');
  await expect(legend(page)).toContainText('positive');
  await expect(page.locator('.term-cloud text').first()).toHaveAttribute('style', /fill/);

  await legend(page).getByRole('button', { name: /negative/ }).click();
  await idle(page);
  await expect(page.locator('#search-chips .path-chip')).toContainText('sentiment = negative');
  expect((await snapshot(page)).rows, 'a legend click highlights, it never filters').toBe(2224);

  await page.selectOption('#terms-color', 'col:rating');
  await expect(legend(page).locator('.legend-value')).toHaveCount(2, { timeout: 60000 });
  await expect(legend(page)).toContainText('1 ·');
  await expect(legend(page)).toContainText('2 ·');
  await expect(legend(page)).not.toContainText('4 ·');
});

test('color: coverage is shown and missingness that depends on the text is flagged', async ({ app }) => {
  const { page } = app;
  await importRows(page, planted());
  // The column is listed at once; its coverage appears only after the screen, which waits for Python to load.
  await expect(option(page, 'col:signal')).toContainText('60%', { timeout: 90000 });
  await expect(option(page, 'col:signal')).not.toContainText('missing differs');
  await expect(option(page, 'col:mnar')).toContainText('missing differs');
  await expect(option(page, 'col:noise')).toContainText('○○○');
  await page.selectOption('#terms-color', 'col:mnar');
  await expect(legend(page)).toContainText('missing values differ in text');
  await page.selectOption('#terms-color', 'col:signal');
  await expect(legend(page)).toContainText('60% of records have a value');
});

test('color: with no significant column Auto shows plain phrases, weak columns stay selectable, and a chosen Size tints by the column', async ({ app }) => {
  const { page } = app;
  const rows = planted().map(({ id, text, noise }) => ({ id, text, noise }));
  await importRows(page, rows);
  await expect(page.locator('#terms-color option').first()).toHaveText('Auto → no column stands out', { timeout: 90000 });
  await expect(legend(page)).toHaveCount(0);
  await expect(option(page, 'col:noise'), 'an insignificant column can still be chosen').toContainText('○○○');
  await page.selectOption('#terms-color', 'col:noise');
  await expect(legend(page)).toContainText('not significant');
  await page.selectOption('#terms-ranking', 'frequency');
  await expect(page.locator('#terms-color'), 'Color does not depend on Size').toHaveValue('col:noise');
  await expect(page.locator('#description-kind')).toHaveText('Common phrases by noise', { timeout: 60000 });
  await expect(page.locator('#terms-results .color-key')).toContainText('takes the color of the noise value');
  await expect(page.locator('#terms-contrast'), 'one population is scored, so its Contrast applies').toBeVisible();
  await page.selectOption('#terms-color', 'none');
  await expect(page.locator('#terms-results .color-key')).toHaveCount(0);
  await expect(page.locator('#terms-contrast option')).toHaveText(['Previous step', 'Rest of the table', 'None (current filter)']);
});

test('even splits: one yes/no question per column, most even first, numbers split at a threshold', async ({ app }) => {
  const { page } = app;
  await page.selectOption('#examples', 'dbrd-test.json');
  await expect.poll(async () => (await snapshot(page)).rows, { timeout: 60000 }).toBe(2224);
  await expect(page.locator('#terms-color option').first()).toHaveText(/Auto →/, { timeout: 90000 });
  await page.click('#terms-options');
  await page.selectOption('#terms-content', 'facets');
  await page.selectOption('#terms-ranking', 'balanced');
  await expect(page.locator('#description-kind')).toHaveText('Even splits');
  await expect(page.locator('.term-field').first()).toBeVisible({ timeout: 30000 });
  const fields = page.locator('.term-field');
  expect(await fields.count()).toBeGreaterThan(2);
  for (const field of await fields.all()) { await expect(field.locator('.term-cloud text, .cloud-overflow button')).toHaveCount(1); }
  const labels = await page.locator('.term-field .term-cloud text').allTextContents();
  expect(labels.some(label => label.startsWith('≤')), 'a numeric column is split at an "at most" threshold').toBe(true);
  expect(labels.every(label => label !== 'Missing' && label !== 'Not missing')).toBe(true);
});
