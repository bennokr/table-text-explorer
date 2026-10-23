import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('vendored DBRD test split retains provenance, ratings, sentiment and reproducible derived counts', async () => {
  const bytes = await readFile('examples/dbrd-test.json');
  const rows = JSON.parse(bytes);
  const source = JSON.parse(await readFile('examples/attribution/dbrd/source.json', 'utf8'));
  assert.equal(rows.length, 2224);
  assert.equal(new Set(rows.map(row => row.review_id)).size, rows.length);
  assert.equal(source.outputSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(source.license, 'CC-BY-NC-SA-4.0');
  assert.equal(rows.filter(row => row.sentiment === 'positive').length, 1112);
  for (const row of rows) {
    assert.equal(row.sentiment, row.rating >= 4 ? 'positive' : 'negative');
    assert.ok(Number.isInteger(row.word_count) && row.word_count > 0);
    assert.equal(row.character_count, [...row.text].length);
  }
});
