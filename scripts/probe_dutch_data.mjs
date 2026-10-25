import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import Papa from 'papaparse';

const revision = 'c72597e0806b42c6ef52c27c4d393bff5ac2c126';
const base = `https://raw.githubusercontent.com/FM12001/DutchABSA/${revision}`;
await mkdir('.cache/acquisition', { recursive: true });
await mkdir('fixtures', { recursive: true });

async function trainingHead() {
  const response = await fetch(`${base}/training_data_083_threshold.json`, { headers: { Range: 'bytes=0-4095' } });
  if (!response.ok) { throw new Error(`Training head failed: ${response.status}`); }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (received < 4096) {
    const { done, value } = await reader.read();
    if (done) { break; }
    chunks.push(value);
    received += value.length;
  }
  await reader.cancel();
  await writeFile('.cache/acquisition/bol-training-head.txt', Buffer.concat(chunks).subarray(0, 4096));
  return { status: response.status, contentRange: response.headers.get('content-range'), receivedBytes: received };
}

async function testData() {
  const response = await fetch(`${base}/testing_data_083_threshold.json`);
  if (!response.ok) { throw new Error(`Bol test download failed: ${response.status}`); }
  const bytes = Buffer.from(await response.arrayBuffer());
  const rows = JSON.parse(bytes);
  await writeFile('.cache/acquisition/bol-testing.json', bytes);
  await writeFile('.cache/acquisition/bol-test-head.json', JSON.stringify(rows.slice(0, 5), null, 2));
  const preview = rows.map((row, source_index) => ({ ...row, source_index,
    pros_text: Object.keys(row.pros).join('\n'), cons_text: Object.keys(row.cons).join('\n'),
    pro_count: Object.keys(row.pros).length, con_count: Object.keys(row.cons).length,
    word_count: row.text.split(/\s+/u).filter(Boolean).length }));
  await writeFile('fixtures/bol-absa-preview.json', JSON.stringify(preview));
  return { revision, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    rows: rows.length, fields: Object.keys(rows[0]),
    bothProsAndCons: rows.filter(row => Object.keys(row.pros).length && Object.keys(row.cons).length).length,
    license: 'No license declared in repository; downloaded data remains local and untracked.' };
}

async function crawlfeedsAccess() {
  const response = await fetch('https://data.crawlfeeds.com/data_collections');
  const repos = await (await fetch('https://huggingface.co/api/datasets?author=crawlfeeds&search=booking')).json();
  const text = await readFile('fixtures/crawlfeeds-booking.csv', 'utf8').catch(error => {
    if (error.code === 'ENOENT') { return null; }
    throw error;
  });
  const sample = text ? Papa.parse(text, { header: true, skipEmptyLines: true }).data : [];
  return { status: response.status, downloadRedirect: response.url,
    publicDatasets: repos.map(repo => repo.id), publicSampleRows: text ? sample.length : null,
    publicSampleLanguages: [...new Set(sample.map(row => row.language))],
    bulkStream: 'No unauthenticated bulk URL exposed; download route redirects to sign-in.' };
}

const [bol, head, crawlfeeds] = await Promise.all([testData(), trainingHead(), crawlfeedsAccess()]);
const report = { bol: { ...bol, trainingHead: head }, crawlfeeds };
await writeFile('docs/evidence/dutch-data-acquisition.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
