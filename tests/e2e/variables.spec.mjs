import { test, expect, importRows, snapshot } from './fixtures.mjs';

async function exerciseComponent(page) {
  await page.evaluate(() => {
    const picker = document.createElement('variable-picker');
    picker.id = 'picker-test';
    picker.multiple = true;
    picker.setAttribute('aria-label', 'Test variables');
    picker.variables = [{ id: 'a', label: 'a', description: 'Café visits', type: 'number', group: 'Activity', nonMissing: 8, missing: 2 },
      { id: 'b', label: 'b', description: 'Free notes', type: 'text', group: 'Notes', nonMissing: 1, missing: 9 },
      { id: 'c', label: 'c', description: 'Other visits', type: 'number', group: 'Activity', nonMissing: 10, missing: 0 }];
    picker.selected = ['b'];
    document.querySelector('.topbar').append(picker);
  });
  const picker = page.locator('#picker-test');
  await picker.getByRole('button', { name: 'Test variables', exact: true }).click();
  await picker.getByRole('button', { name: 'Selected only', exact: true }).click();
  await expect(picker.getByRole('checkbox')).toHaveCount(1);
  await picker.getByRole('button', { name: 'Selected only', exact: true }).click();
  await picker.getByRole('searchbox').fill('cafe');
  await expect(picker.getByRole('checkbox')).toHaveCount(1);
  await picker.getByRole('searchbox').press('ArrowDown');
  await expect(picker.getByRole('checkbox')).toBeFocused();
  await picker.getByRole('checkbox').press('Space');
  expect(await picker.evaluate(node => node.selected)).toEqual(['b', 'a']);
  await picker.getByRole('searchbox').fill('activity');
  await picker.getByRole('button', { name: 'Select group Activity', exact: true }).click();
  await picker.getByRole('searchbox').fill('');
  await picker.getByRole('combobox', { name: 'Variable type' }).selectOption('text');
  await expect(picker.getByRole('checkbox')).toHaveCount(1);
  await picker.getByRole('searchbox').press('Escape');
  await expect(picker.getByRole('button', { name: 'Test variables', exact: true })).toBeFocused();
  expect(await picker.evaluate(node => node.selected)).toEqual(['b', 'a', 'c']);
  await picker.evaluate(node => { node.remove(); document.querySelector('.topbar').append(node); node.disabled = true; });
  await expect(picker.getByRole('button', { name: 'Test variables', exact: true })).toBeDisabled();
  await picker.evaluate(node => node.remove());
}

async function chartPicker(page) {
  const picker = page.locator('[data-point-index="0"]').locator('variable-picker[aria-label="X column"]');
  await picker.getByRole('button', { name: 'X column', exact: true }).click();
  await picker.getByRole('searchbox').fill('y');
  await picker.getByRole('searchbox').press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(picker.getByRole('button', { name: 'X column', exact: true })).toBeFocused();
  expect((await snapshot(page)).views.find(view => view.type === 'scatter').x).toBe('y');
  await expect(picker.locator('.vp-panel')).not.toBeVisible();
}

async function columnPicker(page) {
  const picker = page.locator('#table-columns');
  await picker.getByRole('button', { name: 'Visible table columns', exact: true }).click();
  await picker.getByRole('searchbox').fill('text');
  await picker.getByRole('button', { name: 'Clear shown', exact: true }).click();
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('.data-table thead')).not.toContainText('Sort by text');
  expect((await snapshot(page)).fields.some(field => field.name === 'text')).toBe(true);
  await page.click('#phrase-settings');
  const phrases = page.locator('#terms-fields');
  await phrases.getByRole('button', { name: 'Phrase fields', exact: true }).click();
  await phrases.getByRole('searchbox').fill('text');
  await expect(phrases.getByRole('checkbox')).toBeChecked();
  await phrases.getByRole('searchbox').fill('group');
  await phrases.getByRole('checkbox').check();
  await phrases.getByRole('button', { name: 'Done', exact: true }).click();
  await page.locator('#phrase-form').getByRole('button', { name: 'Apply settings', exact: true }).click();
  await page.click('#analysis-inputs');
  await page.selectOption('#feature-mode', 'words');
  await expect(page.locator('#feature-weights input')).toHaveCount(2);
  await page.locator('#map-dialog [data-close]').click();
}

test('variable picker searches metadata, preserves selection and supports keyboard, charts and table columns', async ({ app }) => {
  await importRows(app.page);
  await app.page.click('#add-chart');
  await exerciseComponent(app.page);
  await chartPicker(app.page);
  await columnPicker(app.page);
});
