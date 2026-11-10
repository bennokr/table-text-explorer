import { test as base, expect } from 'playwright/test';

export const test = base.extend({
  app: async ({ page, context, baseURL }, use) => {
    const errors = [], forbidden = [], models = [], runtimes = [];
    await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await context.route('**/*', async route => {
      const request = route.request();
      const local = new URL(request.url()).origin === baseURL;
      if (!local || request.method() !== 'GET') {
        forbidden.push(request.url());
        await route.abort();
      } else {
        if (request.url().includes('/vendor/ort/')) { runtimes.push(request.url()); }
        if (request.url().includes('/models/')) { models.push(request.url()); }
        await route.continue();
      }
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.waitForFunction(() => window.explorer);
    await use({ page, models, runtimes });
    expect(errors, 'Uncaught application errors').toEqual([]);
    expect(forbidden, 'Unexpected external or non-GET requests').toEqual([]);
  },
});
export { expect };
export const snapshot = page => page.evaluate(() => window.explorer.snapshot());

export const records = Array.from({ length: 24 }, (_, id) => ({ id, x: (id % 7) ** 2,
  y: (id % 11) ** 2, group: id < 12 ? 'camera' : 'battery',
  text: id < 12 ? `Camera maakt scherpe foto's met mooie kleuren ${id}` : `Battery lasts all day with quick charging ${id}` }));

export async function importRows(page, rows = records, csv = false) {
  const data = csv ? [Object.keys(rows[0]).join(','), ...rows.map(row => Object.values(row).join(','))].join('\n') : JSON.stringify(rows);
  await page.setInputFiles('#file', { name: csv ? 'synthetic.csv' : 'synthetic.json',
    mimeType: csv ? 'text/csv' : 'application/json', buffer: Buffer.from(data) });
  await expect.poll(async () => (await snapshot(page)).rows).toBe(rows.length);
  await page.locator('.view-card .bk-events').first().waitFor();
}

export async function query(page, text) {
  await page.fill('#search', text);
  await page.press('#search', 'Enter');
}

export async function idle(page) {
  await page.waitForFunction(() => !window.explorer.snapshot().analysisBusy, null, { timeout: 60000 });
  await expect(page.locator('#status')).not.toHaveClass('error');
}

export async function fields(page, names) {
  const picker = page.locator('#feature-list');
  await picker.getByRole('button', { name: 'Map input columns', exact: true }).click();
  await picker.getByRole('searchbox', { name: 'Search variables', exact: true }).fill('');
  for (const input of await picker.locator('.vp-results input[type=checkbox]').all()) {
    await input.setChecked(names.includes(await input.inputValue()));
  }
  await picker.getByRole('button', { name: 'Done', exact: true }).click();
}

export async function mapForm(page, mode, method = 'pca') {
  await page.click('#analysis-inputs');
  await page.selectOption('#feature-mode', mode);
  if (!['text', 'words'].includes(mode)) { await fields(page, ['text']); }
  await page.selectOption('#map-method', method === 'umap' ? 'umap' : 'linear');
}

export async function finishMap(page) {
  await page.click('#map-submit');
  await expect(page.locator('#map-dialog')).not.toBeVisible();
  await idle(page);
  await page.locator('.view-card').first().locator('.bk-events').waitFor();
}
