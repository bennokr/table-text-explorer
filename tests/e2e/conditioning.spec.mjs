import { test, expect, importRows, query, snapshot, idle, mapForm, finishMap } from './fixtures.mjs';

const cloudButton = (page, name) => page.locator('.term-cloud').getByRole('button', { name });
const chips = page => page.locator('#search-chips .path-chip');

test('clicking highlights and conditions: a path of chips, hidden conditions, NOT and removal', async ({ app }) => {
  const { page } = app;
  await importRows(page);
  await mapForm(page, 'text', 'pca');
  await finishMap(page);
  await query(page, 'group:camera');
  await idle(page);
  await expect(page.locator('#terms-results .term-cloud[aria-busy=false]')).toBeVisible();
  await expect(chips(page)).toHaveCount(1);
  const before = (await snapshot(page)).rows;

  await cloudButton(page, /^camera maakt scherpe$/).click();
  await idle(page);
  await expect(chips(page)).toHaveCount(2);
  await expect(chips(page).nth(1)).toContainText('text contains camera maakt scherpe');
  expect((await snapshot(page)).rows, 'a click highlights, it never filters').toBe(before);
  expect((await snapshot(page)).selected.length).toBeGreaterThan(0);
  await expect(page.locator('#search-count')).toContainText(' of ');
  await page.locator('#terms-results .term-cloud[aria-busy=false]').waitFor();
  await expect(cloudButton(page, /^camera maakt scherpe$/)).toHaveCount(0);
  await expect(cloudButton(page, /^maakt scherpe$/), 'a nested phrase repeats the condition').toHaveCount(0);

  await cloudButton(page, /^mooie kleuren$/).click({ modifiers: ['Alt'] });
  await idle(page);
  await expect(chips(page)).toHaveCount(3);
  await expect(chips(page).nth(2)).toContainText('NOT text contains mooie kleuren');
  expect((await snapshot(page)).selected.length, 'every camera record has that phrase').toBe(0);

  await chips(page).nth(2).getByRole('button').click();
  await idle(page);
  await expect(chips(page)).toHaveCount(2);
  expect((await snapshot(page)).selected.length).toBeGreaterThan(0);
  await chips(page).nth(1).getByRole('button').click();
  await idle(page);
  await expect(chips(page)).toHaveCount(1);
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '"group":"camera"');
});
