import { test, expect, importRows, snapshot, idle, mapForm, finishMap } from './fixtures.mjs';

// A map or scatter colored by a column lists the colors' meaning under the plot; a click highlights.
test('color key: a card colored by a column lists its values, and a click adds the condition', async ({ app }) => {
  const { page } = app;
  await importRows(page);
  await mapForm(page, 'text', 'pca');
  await finishMap(page);
  const card = page.locator('.view-card[data-point="true"]').first();
  const chips = card.locator('.color-key .legend-value');
  await expect(chips, 'no color, no key').toHaveCount(0);

  const color = card.locator('variable-picker[aria-label="Color by"]');
  await color.getByRole('button', { name: 'Color by', exact: true }).click();
  await color.locator('.vp-option', { hasText: 'group' }).first().click();
  await expect(chips).toHaveCount(2);
  await expect(chips.first()).toContainText('· 12');
  const dots = await card.locator('.color-key .chip-dot').evaluateAll(nodes => nodes.map(node => node.style.background));
  expect(new Set(dots).size, 'each value has its own color').toBe(2);

  await chips.filter({ hasText: 'battery' }).click();
  await idle(page);
  await expect(page.locator('#search-chips .path-chip')).toContainText('group = battery');
  expect((await snapshot(page)).selected.length, 'a key click highlights, it never filters').toBe(12);
  expect((await snapshot(page)).rows).toBe(24);

  await chips.filter({ hasText: 'camera' }).click({ modifiers: ['Alt'] });
  await idle(page);
  await expect(page.locator('#search-chips .path-chip').last()).toContainText('NOT group = camera');
});
