import { test, expect, importRows, snapshot } from './fixtures.mjs';

const kinds = async page => Object.fromEntries((await snapshot(page)).fields.map(field => [field.name, field.kind]));

// 12 distinct values each in 120 rows: text this repetitive is categorical, numbers are not.
const rows = Array.from({ length: 120 }, (_, id) => ({ id, code: 10 + (id % 12), tag: `v${String(id % 12).padStart(2, '0')}`,
  text: `Row ${id} has some free text that is long enough to be prose and nothing like a category label` }));

test('text and numeric category limits are separate and re-infer column types', async ({ app: { page } }) => {
  await importRows(page, rows);
  expect(await kinds(page)).toMatchObject({ code: 'number', tag: 'categorical' });

  await page.locator('#column-types').click();
  await expect(page.locator('#category-limit')).toHaveValue('50');
  await expect(page.locator('#numeric-category-limit')).toHaveValue('8');
  await page.locator('#numeric-category-limit').fill('12');
  await page.getByRole('button', { name: 'Apply column types' }).click();
  expect(await kinds(page)).toMatchObject({ code: 'categorical', tag: 'categorical' });

  await page.locator('#column-types').click();
  await expect(page.locator('#numeric-category-limit')).toHaveValue('12');
  await page.locator('#category-limit').fill('10');
  await page.getByRole('button', { name: 'Apply column types' }).click();
  expect(await kinds(page)).toMatchObject({ code: 'categorical', tag: 'text' });
});
