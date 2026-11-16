import { test, expect, importRows } from './fixtures.mjs';

// The Dutch lexicon (src/lexicon/nl) is bundled with the app and decides which phrases the index can contain.
// (Merging variants such as boek/boeken is checked in tests/check_terms.py, where the cloud is not cut short.)
test('lexicon: empty words stay out of the cloud, negations stay in, lead words only start phrases', async ({ app }) => {
  const { page } = app;
  const rows = Array.from({ length: 24 }, (_, id) => ({ id, text: id % 2
    ? 'deze boeken zijn niet goed zonder humor' : 'dit boek is geen succes zonder humor' }));
  await importRows(page, rows);
  const words = page.locator('#terms-results .term-cloud text');
  await expect(words.first()).toBeVisible({ timeout: 90000 });
  await page.click('#terms-options');
  await page.locator('#terms-deduplicate').uncheck();
  const phrases = () => words.evaluateAll(nodes => nodes.map(node => node.dataset.term));
  await expect.poll(async () => (await phrases()).length, { timeout: 30000 }).toBeGreaterThan(10);
  const shown = await phrases();
  for (const empty of ['deze', 'dit', 'zijn', 'is']) { expect(shown, `${empty} is a stopword`).not.toContain(empty); }
  expect(shown, 'a negation is a phrase of its own').toEqual(expect.arrayContaining(['niet', 'geen']));
  expect(shown, 'a lead word starts a phrase').toContain('zonder humor');
  expect(shown.filter(phrase => phrase === 'zonder' || phrase.endsWith(' zonder')), 'but never stands alone or ends one').toEqual([]);
});
