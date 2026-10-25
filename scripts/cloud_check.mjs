import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { browserSession } from './browser_session.mjs';

const session = await browserSession();
const { page } = session;
const ready = () => page.locator('.term-field .term-cloud[aria-busy=false]').waitFor();
const cloud = () => page.locator('.term-field .term-cloud');

async function fixture() {
  await page.click('#show-terms');
  await page.evaluate(async () => {
    const { renderTerms } = await import('/src/term-view.js');
    const phrases = ['kleur komt overeen', 'afbeelding', 'goede kwaliteit', 'prijs', 'snel bezorgd',
      'gebruik', 'mooi ontwerp', 'handig', 'stevig', 'past goed', 'eenvoudig', 'batterij', 'scherm', 'geluid', 'verpakking'];
    const terms = phrases.map((phrase, index) => ({ phrase, contrast: 1 / (index + 1), ctfidf: 1 / (index + 1), lift: 3,
      support: 18, subsetSize: 19, rest: 1, restSize: 981, examples: [] }));
    window.drawCloud = () => renderTerms(document.querySelector('#terms-results'), { comparison: 981, ranking: 'contrast',
      fields: [{ name: 'pros_text', vocabulary: 2565, terms, representatives: [] }] }, { rows: [] },
    (_, phrase) => { window.lastCloudPhrase = phrase; }, new Map([['pros_text', true]]));
    window.drawCloud();
  });
  await ready();
}

async function interactions() {
  assert.equal(await cloud().getByRole('button').count(), 15);
  await cloud().getByRole('button').first().focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Highlight matches' }).click();
  assert.ok(await page.evaluate(() => window.lastCloudPhrase));
  await page.screenshot({ path: '.cache/phrase-cloud-preview.png' });
  await page.evaluate(() => { document.querySelector('.term-cloud').style.width = '160px'; });
  await page.waitForFunction(() => document.querySelector('.term-cloud svg').getAttribute('width') === '160');
  await ready();
  assert.equal(await cloud().getByRole('button').count(), 15);
  await page.evaluate(() => { window.drawCloud(); document.querySelector('.term-cloud').hidden = true; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => { document.querySelector('.term-cloud').hidden = false; });
  await ready();
  await page.evaluate(() => { window.drawCloud(); window.drawCloud(); });
  await ready();
  assert.equal(await cloud().getByRole('button').count(), 15);
}

async function overflow() {
  await page.evaluate(async () => {
    const { phraseCloud } = await import('/src/phrase-cloud.js');
    const root = phraseCloud([{ phrase: 'x'.repeat(2000), contrast: 1 }], 'contrast', () => 'Long phrase', () => {});
    root.id = 'long-cloud';
    root.style.width = '160px';
    document.querySelector('#terms-results').append(root);
  });
  await page.locator('#long-cloud[aria-busy=false]').waitFor();
  assert.equal(await page.locator('#long-cloud .cloud-overflow button').count(), 1);
}

try {
  await fixture();
  await interactions();
  await overflow();
  assert.deepEqual(session.errors, []);
  assert.ok(session.requests.every(request => request.local && request.method === 'GET'));
  const report = { phrases: 15, keyboard: true, resizing: true, hiddenAndReplaced: true,
    unplacedFallback: true, pageErrors: 0, externalRequests: 0, gpuDisabled: true };
  await writeFile('docs/evidence/cloud-results.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally { await session.close(); }
