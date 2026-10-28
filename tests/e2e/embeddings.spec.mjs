import { test, expect, importRows, snapshot, mapForm, finishMap, fields } from './fixtures.mjs';

async function describedDutchMap(page, fitted, models) {
  await mapForm(page, 'sentences');
  await page.selectOption('#sentence-model', 'dutch');
  await fields(page, ['text', 'notes']);
  await page.selectOption('#field-combine', 'group-mean');
  await page.locator('#embedding-options > details > summary').click();
  await page.check('#include-descriptions');
  await page.locator('#group-combining details > summary').click();
  await page.getByLabel('Group for text', { exact: true }).fill('Main');
  await page.getByLabel('Group for notes', { exact: true }).fill('Context');
  await finishMap(page);
  const dutch = await snapshot(page);
  expect(dutch.projections[0].config.sentenceModel).toBe('dutch');
  expect(dutch.projections[0].dimensions).toBe(1152);
  expect(dutch.projections[0].config.combine).toBe('group-mean');
  expect(dutch.projections[0].config.includeDescriptions).toBe(true);
  expect(dutch.projections[0].coverage[0].missing).toBe(1);
  expect(dutch.projections[0].coverage[0].descriptionTokensPerChunk).toBeGreaterThan(0);
  expect(dutch.projections[1]).toEqual(fitted.projections[0]);
  expect(models.some(url => url.includes('/MarkSelles/dutch-minilm-l6-v2/'))).toBe(true);
  await mapForm(page, 'words');
  await expect(page.locator('#field-combine option[value="group-mean"]')).toHaveCount(0);
  await expect(page.locator('#field-combine')).toHaveValue('mean');
  await page.locator('#map-dialog [data-close]').click();
}

test('embeddings: explicit word/sentence maps use real local workers and keep earlier results', async ({ app }) => {
  test.setTimeout(240000);
  const { page, models, runtimes } = app;
  await importRows(page, [{ id: 0, text: 'De kat zit op de mat.', notes: 'Een dier.' },
    { id: 1, text: 'The cat sits on the mat.', notes: 'Een dier.' },
    { id: 2, text: 'Het vliegtuig vliegt naar de luchthaven.', notes: 'Reizen.' },
    { id: 3, text: '', notes: '' }]);
  expect(models).toEqual([]);
  // Cold library startup has a separate budget from individual analysis jobs.
  await page.waitForFunction(() => {
    const state = window.explorer.snapshot();
    return state.runtime.sklearn === 'loaded' && !state.busy && !state.analysisBusy;
  }, null, { timeout: 120000 });
  await mapForm(page, 'words');
  await expect(page.locator('#field-combine option[value="description-mean"]')).toHaveCount(0);
  await finishMap(page);
  const words = (await snapshot(page)).projections[0];
  expect(words.dimensions).toBe(300);
  expect(models).toEqual([]);
  await mapForm(page, 'sentences');
  await expect(page.locator('#sentence-options')).toBeVisible();
  await finishMap(page);
  const fitted = await snapshot(page);
  expect(fitted.projections[0].config.mode).toBe('sentences');
  expect(fitted.projections[0].count).toBe(3);
  expect(fitted.projections[0].dimensions).toBe(384);
  expect(fitted.projections[0].coverage[0].missing).toBe(1);
  expect(fitted.projections[1]).toEqual(words);
  expect(models.length).toBeGreaterThan(0);
  expect(runtimes.some(url => url.endsWith('ort-wasm-simd-threaded.asyncify.wasm'))).toBe(true);
  expect(runtimes.every(url => /ort-wasm-simd-threaded\.asyncify\.(mjs|wasm)$/u.test(url))).toBe(true);
  await describedDutchMap(page, fitted, models);
  await page.click('#export');
  await expect(page.locator('#results-list')).toContainText('pooled embeddings (384 dimensions)');
});
