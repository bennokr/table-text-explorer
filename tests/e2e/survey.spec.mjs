import { test, expect, importRows, snapshot, finishMap, idle } from './fixtures.mjs';

// Two kinds of respondent, answers to a few questions, and some blanks.
const survey = Array.from({ length: 30 }, (_, id) => {
  const kind = id % 2;
  return { id, kind: kind ? 'a' : 'b', q1: kind ? 'yes' : 'no', q2: kind ? 3 : 1, age: 20 + (id % 7),
    follow: id % 3 ? '' : (kind ? 'yes' : 'no'), score: kind ? 8 + (id % 2) : 2 + (id % 3) };
});

test('survey answers: the map dialog shows its own settings and makes a map without refitting anything else', async ({ app }) => {
  const { page } = app;
  await importRows(page, survey, true);
  await page.click('#analysis-inputs');
  await page.selectOption('#feature-mode', 'survey');
  await expect(page.locator('#survey-options')).toBeVisible();
  await expect(page.locator('#survey-missing-summary')).toContainText('No routing rules');
  await expect(page.locator('#combine-row'), 'groups and weights replace Combine columns').toBeHidden();
  await expect(page.locator('#group-combining')).toBeHidden();
  await expect(page.locator('#sentence-options'), 'no free text, so no sentence model').toBeHidden();
  await page.locator('#survey-text-weight').evaluate(input => { input.value = '50'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('#survey-text-weight-value')).toHaveText('50%');
  await page.selectOption('#map-method', 'linear');
  await finishMap(page);
  await expect(page.locator('.view-card [aria-description]').first()).toHaveAttribute('aria-description', /nearest neighbours shared with a map of blanks alone/);
  const state = await snapshot(page);
  expect(state.projection).toBe('pca');
  expect(state.fittedRows).toBe(30);

  await page.click('#cluster');
  await page.fill('#cluster-count', '2');
  await page.click('#cluster-submit');
  await idle(page);
  const names = page.locator('.cluster-legend .cluster-name');
  await expect(names.first(), 'groups are named by the answers that set them apart').toHaveValue(/q1: (yes|no)/);
  await expect(names.first()).toHaveAttribute('title', /stability 1/);
});

test('survey answers: other inputs hide the survey settings again', async ({ app }) => {
  const { page } = app;
  await importRows(page, survey, true);
  await page.click('#analysis-inputs');
  await page.selectOption('#feature-mode', 'survey');
  await page.selectOption('#feature-mode', 'table');
  await expect(page.locator('#survey-options')).toBeHidden();
  await expect(page.locator('#combine-row')).toBeHidden();
});
