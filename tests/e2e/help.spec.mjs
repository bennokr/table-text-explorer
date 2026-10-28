import { test, expect, importRows, mapForm, fields } from './fixtures.mjs';

async function groupedDraft(page) {
  await mapForm(page, 'sentences');
  await fields(page, ['text', 'notes']);
  await page.fill('#map-name', 'Keep this name');
  await expect(page.locator('#feature-mode option[value=sentences]')).toHaveText('Text · sentence embeddings');
  await expect(page.locator('#weights-details')).not.toHaveAttribute('open', '');
  await page.selectOption('#field-combine', 'group-mean');
  await page.locator('#embedding-options > details > summary').click();
  await page.check('#include-descriptions');
  await page.locator('#group-identity').focus();
  await page.locator('#group-identity').press('ArrowRight');
  await expect(page.locator('#group-identity-value')).toHaveText('25%');
  await page.locator('#group-combining details > summary').click();
  await page.getByLabel('Group for text', { exact: true }).fill('Communication');
  await page.getByLabel('Group for notes', { exact: true }).fill('Support');
  await page.getByLabel('Group for notes', { exact: true }).press('Tab');
  await expect(page.locator('#groups-summary')).toHaveText('Variable groups · 2 groups');
  await page.locator('#weights-details > summary').click();
  await page.getByLabel('Weight of text', { exact: true }).fill('2');
  await expect(page.locator('#weights-summary')).toHaveText('Field weights · 1 customized');
  await page.getByLabel('Weight of text', { exact: true }).fill('-1');
  await page.locator('#weights-details').evaluate(details => { details.open = false; });
  await page.locator('#map-form').evaluate(form => form.reportValidity());
  await expect(page.locator('#weights-details')).toHaveAttribute('open', '');
  await page.click('#weights-reset');
  await expect(page.getByLabel('Weight of text', { exact: true })).toHaveValue('1');
}

async function contextualJourney(page) {
  const hint = page.locator('[data-help="combining#preserve-group-identity"]');
  await expect(hint).toHaveAttribute('title', /balances shared semantic meaning/);
  const box = await hint.boundingBox();
  expect(Math.abs(box.width - box.height)).toBeLessThan(1);
  await hint.click();
  await expect(page.locator('#help-title')).toHaveText('Combining fields');
  await expect(page.locator('#help-content #preserve-group-identity')).toBeInViewport();
  await page.selectOption('#help-topic', 'text-models');
  await page.locator('#help-content a[data-help=combining]').click();
  await expect(page.locator('#help-title')).toHaveText('Combining fields');
  await page.click('#help-back');
  await expect(page.locator('#help-title')).toHaveText('Text models');
  await page.click('#help-back');
  await expect(page.locator('#help-title')).toHaveText('Combining fields');
  await page.keyboard.press('Escape');
  await expect(hint).toBeFocused();
  await expect(page.locator('#map-dialog')).toBeVisible();
  await expect(page.locator('#map-name')).toHaveValue('Keep this name');
  await expect(page.locator('#group-identity')).toHaveValue('25');
}

test('help: progressive settings, group controls, native tooltips and linked pages preserve map drafts', async ({ app }) => {
  await importRows(app.page, [{ id: 0, x: 1, text: 'First answer', notes: 'More context' },
    { id: 1, x: 2, text: 'Second answer', notes: 'Other context' }, { id: 2, x: 3, text: 'Third answer', notes: '' }]);
  await groupedDraft(app.page);
  await contextualJourney(app.page);
  await app.page.locator('#map-dialog [data-close]').click();
  await app.page.click('#help');
  await expect(app.page.locator('#help-title')).toHaveText('Help and shortcuts');
  await app.page.locator('#help-content a[data-help=maps]').first().click();
  await expect(app.page.locator('#help-title')).toHaveText('Similarity maps');
  expect(app.models).toEqual([]);
});
