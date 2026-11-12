import { test, expect, importRows, records, snapshot, idle, mapForm, finishMap } from './fixtures.mjs';

async function phraseFields(page) {
  await page.click('#phrase-settings');
  const picker = page.locator('#terms-fields');
  await picker.getByRole('button', { name: 'Phrase fields', exact: true }).click();
  await picker.getByRole('searchbox').fill('notes');
  await picker.getByRole('checkbox').check();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await page.selectOption('#terms-sizes', '1:1');
  await page.selectOption('#terms-language', 'none');
  await page.locator('#phrase-form').getByRole('button', { name: 'Apply settings', exact: true }).click();
}

async function combinedQueries(page) {
  await expect(page.locator('#terms-results .term-field')).toHaveCount(2, { timeout: 60000 });
  await expect(page.locator('#description-kind')).toHaveText('Common phrases');
  await page.click('#terms-options');
  // Playwright does not report an option inside a label as disabled, so these read the DOM property.
  await expect(page.locator('#terms-ranking option[value=semantic]')).toHaveJSProperty('disabled', true);
  await page.selectOption('#terms-display', 'combined');
  await expect(page.locator('.term-field-legend span')).toHaveText(['text', 'notes']);
  await page.getByLabel('Cloud view for Selected fields', { exact: true }).uncheck();
  await expect(page.locator('.term-table thead')).toContainText('Field');
  await page.getByLabel('Cloud view for Selected fields', { exact: true }).check();
  const cloud = page.locator('#terms-results .term-cloud[aria-busy=false]');
  await expect(cloud).toHaveCount(1);
  await expect(cloud.locator('text[data-term=camera]')).toHaveCount(2);
  await cloud.locator('text[data-term=camera][data-field=text]').click();
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '"text"~"camera"');
  await expect.poll(async () => (await snapshot(page)).selected.length).toBe(12);
  await expect(page.locator('#terms-status')).toHaveText(/12 subset \/ 12 comparison/);
  await expect(page.locator('.term-field-legend span')).toHaveCount(2);
  await conjoinPhrase(page);
  await expect(page.locator('#terms-ranking option[value=balanced]'), 'even splits answer metadata questions, not phrases').toHaveJSProperty('disabled', true);
  await page.selectOption('#terms-content', 'both');
  await page.selectOption('#terms-ranking', 'balanced');
  await expect(page.locator('#description-kind')).toHaveText('Even splits');
  await page.selectOption('#terms-compare', 'population:all');
  await expect(page.locator('#terms-status')).toHaveText(/24 subset \/ 0 comparison/);
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]').first()).toBeVisible();
  await page.selectOption('#terms-content', 'phrases');
  await expect(page.locator('#terms-ranking'), 'leaving metadata predicates resets even splits').toHaveValue('auto');
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]')).toHaveCount(1);
  await page.click('#filter-selection');
  await page.selectOption('#terms-compare', 'population:visible');
  await expect(page.locator('#terms-status')).toHaveText(/12 subset \/ 0 comparison/);
  await page.click('#clear-filters');
}

async function conjoinPhrase(page) {
  await page.locator('.term-cloud[aria-busy=false] text[data-term=battery][data-field=notes]').click();
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '"text"~"camera" AND "notes"~"battery"');
  await expect.poll(async () => (await snapshot(page)).selected.length).toBe(12);
}

async function semanticAndClusters(page) {
  await mapForm(page, 'words');
  await page.selectOption('#field-combine', 'concat');
  await finishMap(page);
  await expect(page.locator('#terms-ranking option[value=semantic]')).toHaveJSProperty('disabled', false);
  await page.selectOption('#terms-ranking', 'semantic');
  await expect(page.locator('#terms-embedding')).toBeVisible();
  await expect(page.locator('#description-kind')).toHaveText('Semantic splits');
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]')).toHaveCount(1);
  await page.selectOption('#terms-ranking', 'auto');
  await page.click('#cluster');
  await page.selectOption('#cluster-method', 'kmeans');
  await page.fill('#cluster-count', '2');
  await page.click('#cluster-submit');
  await idle(page);
  // A flat clustering is a column: Compare by its name column colours one cloud per field by cluster.
  const column = await page.locator('#terms-compare option[value^="col:"]', { hasText: '· name' }).first().getAttribute('value');
  await page.selectOption('#terms-compare', column);
  await expect(page.locator('.compare-legend .legend-value')).toHaveCount(2, { timeout: 60000 });
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]')).toHaveCount(2);
}

test('phrases: whole-dataset clouds, field-specific combined queries, splits and cluster clouds', async ({ app }) => {
  const { page, models } = app;
  await importRows(page, records.map((row, id) => ({ ...row, notes: records[(id + 12) % 24].text })));
  await phraseFields(page);
  await combinedQueries(page);
  await semanticAndClusters(page);
  expect(models).toEqual([]);
});
