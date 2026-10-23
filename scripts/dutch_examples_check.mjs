import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { browserSession } from './browser_session.mjs';

const session = await browserSession();
const { page } = session;
const snapshot = () => page.evaluate(() => window.explorer.snapshot());

async function fit(method, slot = 0) {
  await page.selectOption(slot ? '#projection-secondary' : '#projection', method);
  await page.click(slot ? '#fit-secondary' : '#fit');
  await page.waitForFunction(() => !document.querySelector('#fit').disabled, null, { timeout: 240000 });
  const result = (await snapshot()).projections[slot];
  assert.equal(result?.method, method, await page.locator('#status').textContent());
  assert.equal(result.config.vectorLanguage, 'nl');
  assert.ok(result.coverage.every(field => field.matched > 0));
  return result;
}

try {
  await page.selectOption('#examples', 'dbrd-test.json');
  await page.waitForFunction(() => window.explorer.snapshot().rows === 2224);
  const dbrd = await fit('pca');
  assert.equal(dbrd.count, 2224);
  assert.deepEqual(dbrd.config.features, ['text']);
  await page.check('#compare');
  const umap = await fit('umap', 1);
  assert.equal(umap.count, 2224);
  assert.deepEqual((await snapshot()).projections[0], dbrd);
  await page.screenshot({ path: '.cache/dbrd-example.png' });
  await page.selectOption('#examples', 'bol-absa-preview.json');
  await page.waitForFunction(() => window.explorer.snapshot().rows === 1000);
  const bol = await fit('svd');
  assert.deepEqual(bol.config.features, ['pros_text', 'cons_text']);
  assert.ok(bol.count > 500 && bol.count <= 1000);
  const preview = JSON.parse(await readFile('fixtures/bol-absa-preview.json', 'utf8'));
  const original = JSON.parse(await readFile('.cache/acquisition/bol-testing.json', 'utf8'));
  assert.equal(preview[0].text, original[0].text);
  assert.deepEqual(preview[0].pros, original[0].pros);
  assert.equal(preview[0].pros_text, Object.keys(original[0].pros).join('\n'));
  assert.deepEqual(session.errors, []);
  assert.ok(session.requests.every(request => request.local && request.method === 'GET'));
  const result = { dbrdRows: dbrd.count, bolRows: 1000, bolEmbedded: bol.count,
    pageErrors: 0, externalRequests: 0, gpuDisabled: true };
  await writeFile('docs/dutch-examples-results.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} catch (error) {
  console.error('Status:', await page.locator('#status').textContent());
  await page.screenshot({ path: '.cache/dutch-examples-failure.png' }).catch(() => {});
  throw error;
} finally { await session.close(); }
