import { test, expect, importRows, snapshot, idle } from './fixtures.mjs';

const options = page => page.locator('#suggest-list [role=option]');
const chips = page => page.locator('#search-chips .path-chip');

test('query field: columns, operators and values are suggested and become removable tokens', async ({ app }) => {
  const { page } = app;
  await importRows(page);
  await page.focus('#search');
  await expect(options(page).first()).toBeVisible();
  const columns = await options(page).locator('.suggest-label').allTextContents();
  expect(columns, 'an empty field already lists the columns').toEqual(expect.arrayContaining(['group', 'x', 'y', 'text']));
  await expect(options(page).filter({ hasText: 'group' }).locator('small')).toHaveText(/category/);

  await page.fill('#search', 'gr');
  await expect(options(page)).toHaveCount(1);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#search')).toHaveValue('group ');
  await expect(options(page).locator('.suggest-label')).toHaveText(['=', '!=']);

  await options(page).first().click();
  await expect(page.locator('#search')).toHaveValue('group =');
  await expect(options(page).first()).toContainText(/camera|battery/);
  await expect(options(page).first().locator('small')).toHaveText('12 records');
  await options(page).filter({ hasText: 'camera' }).click();

  await expect(chips(page)).toHaveCount(1);
  await expect(chips(page).first()).toContainText('group = camera');
  await expect(page.locator('#search')).toHaveValue('');
  await idle(page);
  expect((await snapshot(page)).selected).toHaveLength(12);
  await expect(page.locator('#search-count')).toHaveText('12 of 24');
});

test('query field: typed conditions narrow the path, Backspace removes the last token, a complex query is one token', async ({ app }) => {
  const { page } = app;
  await importRows(page);
  await page.fill('#search', 'group:camera');
  await page.press('#search', 'Enter');
  await page.fill('#search', 'y>10');
  await page.press('#search', 'Enter');
  await expect(chips(page)).toHaveCount(2);
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', /"group":"camera" AND "y">"10"/);
  await page.press('#search', 'Backspace');
  await expect(chips(page)).toHaveCount(1);
  await expect(page.locator('#search-box')).toHaveAttribute('data-query', '"group":"camera"');

  await chips(page).first().getByRole('button').click();
  await expect(chips(page)).toHaveCount(0);
  await page.fill('#search', 'group:camera OR group:battery');
  await page.press('#search', 'Enter');
  await expect(chips(page)).toHaveCount(1);
  await expect(chips(page).first()).toContainText('OR');
  await idle(page);
  expect((await snapshot(page)).selected).toHaveLength(24);

  await page.fill('#search', 'group:');
  await page.press('#search', 'Escape');
  await expect(page.locator('#suggest-list')).toBeHidden();
});
