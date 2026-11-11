import { test, expect, importRows, snapshot, idle, mapForm, finishMap } from './fixtures.mjs';

function vectors(count = 80) {
  const values = new Float32Array(count * 4);
  for (let id = 0; id < count; id += 1) {
    const base = id < count / 2 ? [1, 0.1, 0, 0] : [0, 0, 1, 0.1];
    base.forEach((value, index) => { values[id * 4 + index] = value + 0.01 * ((id * 7 + index) % 5); });
  }
  return values;
}

// The screen needs 60 records; two groups of 40 with their own words.
const rows = Array.from({ length: 80 }, (_, id) => ({ id, x: (id % 7) ** 2, y: (id % 11) ** 2, group: id < 40 ? 'camera' : 'battery',
  text: id < 40 ? `Camera maakt scherpe foto's met mooie kleuren ${id % 9}` : `Battery lasts all day with quick charging ${id % 9}` }));

const toRgb = hex => `rgb(${[1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16)).join(', ')})`;

test('layout: defaults are informative, x clears them, the legend sits by the map, names exist and colours agree', async ({ app }) => {
  const { page } = app;
  await importRows(page, rows);
  const defaults = (await snapshot(page)).views.map(view => view.type);
  expect(defaults, 'two category bars and one histogram, no scatter against the row number').toEqual(['bar', 'bar', 'histogram']);

  await page.click('#clear-views');
  await expect(page.locator('.view-card')).toHaveCount(0);

  await mapForm(page, 'sentences');
  await page.locator('#embedding-file').setInputFiles({ name: 'v.f32', mimeType: 'application/octet-stream', buffer: Buffer.from(vectors().buffer) });
  await finishMap(page);
  await page.click('#add-chart');
  await page.click('#cluster');
  await expect(page.locator('#cluster-suggest-names')).toBeChecked();
  await page.fill('#cluster-count', '2');
  await page.click('#cluster-submit');
  await idle(page);
  await page.locator('.cluster-legend').last().waitFor();
  const order = (await snapshot(page)).views.map(view => view.type);
  expect(order.slice(0, 2), 'the legend follows the map even though another card was added in between').toEqual(['map', 'legend']);

  const names = await page.locator('.cluster-legend input.cluster-name').evaluateAll(inputs => inputs.map(input => input.value));
  expect(names).toHaveLength(2);
  expect(names.every(name => !name.startsWith('#'))).toBe(true);

  await expect(page.locator('#terms-compare option').first()).toContainText(/Auto/);
  const clusterOption = await page.locator('#terms-compare option[value^="col:"]', { hasText: '· name' }).first().getAttribute('value');
  await page.selectOption('#terms-compare', clusterOption);
  await expect(page.locator('.compare-legend strong')).toContainText('· name', { timeout: 60000 });
  await expect(page.locator('.term-cloud text').first()).toHaveAttribute('style', /fill/);
  const legendColors = await page.locator('.cluster-legend input[type=color]').evaluateAll(inputs => inputs.map(input => input.value));
  const cloudColors = await page.locator('.term-cloud text').evaluateAll(nodes => [...new Set(nodes.map(node => node.style.fill))]);
  expect(cloudColors.length).toBeGreaterThan(0);
  expect(cloudColors, 'every word has a cluster colour').not.toContain('');
  for (const color of cloudColors) { expect(legendColors.map(toRgb)).toContain(color.replace(/,\s*/gu, ', ')); }
});
