import { test, expect, importRows, query, snapshot, idle, mapForm, finishMap } from './fixtures.mjs';

async function buildIndex(page) {
  await query(page, 'group:camera');
  await idle(page);
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]')).toBeVisible();
  await expect(page.locator('#terms-controls')).not.toBeVisible();
  // Phrases tie at 12 of 24 records and sort alphabetically, so the first one may belong to the
  // other group. Click a phrase that really occurs in the highlighted camera records.
  await page.locator('.term-cloud').getByRole('button', { name: /camera maakt scherpe/ }).click();
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', /AND "text"~/);
  await idle(page);
  expect((await snapshot(page)).selected.length).toBeGreaterThan(0);
  await page.locator('#terms-results .term-cloud[aria-busy=false]').waitFor();
  await page.getByLabel('Cloud view for text').uncheck();
  await page.locator('.term-table button').first().click();
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', /AND "text"~/);
  await idle(page);
  await page.getByLabel('Cloud view for text').check();
}

async function indexConfigurations(page) {
  await page.click('#phrase-settings');
  await page.fill('#terms-name', 'Default');
  await page.click('#terms-save');
  await page.selectOption('#terms-sizes', '1:1');
  await page.fill('#terms-name', 'Words');
  await page.click('#terms-save');
  await page.locator('#phrase-form').getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]')).toBeVisible();
  await page.click('#phrase-settings');
  await page.getByLabel('Phrase counting preset', { exact: true }).selectOption({ label: 'Default' });
  await expect(page.locator('#terms-sizes')).toHaveValue('1:3');
  await page.locator('#phrase-form').getByRole('button', { name: 'Apply settings' }).click();
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]')).toBeVisible();
}

// The newest legend is placed right after the map, ahead of older ones.
async function cluster(page, method) {
  await page.click('#cluster');
  await expect(page.locator('#cluster-suggest-names'), 'names are suggested by default').toBeChecked();
  await expect(page.locator('#cluster-naming .name-length')).toHaveValue('4');
  await page.selectOption('#cluster-method', method);
  if (method === 'hdbscan') {
    await page.fill('#cluster-min-size', '3');
    await page.fill('#cluster-min-samples', '2');
  } else { await page.fill('#cluster-count', '2'); }
  await page.click('#cluster-submit');
  await idle(page);
  await page.locator('.cluster-legend').first().waitFor();
}

async function adjacentLegend(page) {
  // The legend is placed right after its map, so the map is already colored by the clusters.
  expect((await snapshot(page)).views.map(view => view.type).slice(0, 2)).toEqual(['map', 'legend']);
  const color = page.locator('.view-card').first().getByRole('button', { name: 'Color by', exact: true });
  await expect(color).toBeDisabled();
  const selected = await page.locator('.view-card').first().locator('variable-picker[aria-label="Color by"]').evaluate(picker => picker.selected[0]);
  expect(selected).toContain(' · name');
}

async function treeAndDescriptions(page) {
  const legend = page.locator('.cluster-legend').first();
  const branch = legend.locator('.active-cut').first();
  const generated = await legend.locator('.active-cut input.cluster-name').evaluateAll(inputs => inputs.map(input => input.value));
  expect(generated.every(value => !value.startsWith('#'))).toBe(true);
  const words = generated.map(value => value.toLowerCase().match(/[\p{L}\p{N}]+/gu));
  expect(words[0].filter(word => words[1].includes(word))).toEqual([]);
  const name = branch.getByRole('textbox', { name: /^Name for cluster/ });
  await name.fill('Camera group');
  await name.press('Tab');
  await branch.getByRole('button', { name: /Describe branch/ }).click();
  await expect(page.locator('#terms-results details[data-group-id]')).toHaveCount(1);
  await page.click('#terms-options');
  await query(page, 'group:battery');
  await expect(page.locator('#terms-color')).toHaveValue('auto');
  await expect(page.locator('#terms-status')).toHaveText(/12 subset \/ 12 comparison/);
  await expect(page.locator('#terms-results details[data-group-id]')).toHaveCount(0);
  await legend.getByRole('spinbutton').fill('1');
  await legend.getByRole('spinbutton').press('Tab');
  await legend.getByRole('spinbutton').fill('2');
  await legend.getByRole('spinbutton').press('Tab');
  await legend.getByLabel('Maximum phrases per cluster name').selectOption('2');
  await legend.getByRole('button', { name: 'Rename all', exact: true }).click();
  await idle(page);
  await expect(name).toHaveValue('Camera group');
  const tree = legend.locator('details').first();
  await tree.locator(':scope > summary').click({ position: { x: 5, y: 8 } });
  await expect(tree).not.toHaveAttribute('open', '');
  expect((await snapshot(page)).fields.filter(field => field.name.endsWith(' · ID'))).toEqual([]);
}

async function densitySelection(page) {
  await cluster(page, 'hdbscan');
  const legend = page.locator('.cluster-legend').first();
  await expect(legend.locator('[data-cluster-id="-1"]')).toBeVisible();
  await expect(legend.locator('[data-cluster-id="-1"] input.cluster-name')).toHaveValue('Other');
  await legend.getByLabel('Density cluster selection', { exact: true }).selectOption('leaf');
  await idle(page);
  await expect(legend.getByLabel('Density cluster selection', { exact: true })).toHaveValue('leaf');
  await expect(legend.locator('.active-cut')).toHaveCount(2);
}

test('analysis: map creation, phrase highlighting, tree naming and scrubbing after clustering', async ({ app }) => {
  const { page, models } = app;
  await importRows(page);
  await mapForm(page, 'text', 'umap');
  await page.fill('#neighbors', '3');
  await page.fill('#epochs', '50');
  await finishMap(page);
  const coordinates = (await snapshot(page)).coordinates;
  await buildIndex(page);
  await indexConfigurations(page);
  await cluster(page, 'agglomerative');
  await adjacentLegend(page);
  await treeAndDescriptions(page);
  await densitySelection(page);
  expect((await snapshot(page)).coordinates).toEqual(coordinates);
  expect(models).toEqual([]);
});
