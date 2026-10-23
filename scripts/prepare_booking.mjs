import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const revision = 'f39ceeede7b9d8a824909ebe88a7723ad31fa6c5';
const filename = 'Crawlfeeds_booking-italy-hotel-reviews__limit-100000_language-en_after-2025-06_reviewer_country-3-items_20260410_063921.csv';
const base = `https://huggingface.co/datasets/crawlfeeds/Booking-Hotel-Reviews-Dataset/resolve/${revision}`;
await mkdir('fixtures', { recursive: true });
await mkdir('.cache/crawlfeeds', { recursive: true });
await mkdir('public/attribution', { recursive: true });
const response = await fetch(`${base}/${filename}`);
if (!response.ok) { throw new Error(`Dataset download failed: ${response.status}`); }
const bytes = Buffer.from(await response.arrayBuffer());
await writeFile('fixtures/crawlfeeds-booking.csv', bytes);
const card = await fetch(`${base}/README.md`);
if (!card.ok) { throw new Error('Dataset attribution download failed.'); }
const attribution = `Source: https://huggingface.co/datasets/crawlfeeds/Booking-Hotel-Reviews-Dataset\nRevision: ${revision}\nLicense: CC-BY-NC-4.0\n\n${await card.text()}`;
await writeFile('.cache/crawlfeeds/README.md', attribution);
await writeFile('public/attribution/crawlfeeds.md', attribution);
await writeFile('.cache/crawlfeeds/source.json', JSON.stringify({ revision, filename,
  license: 'CC-BY-NC-4.0', sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2));
console.log(`Prepared local Crawlfeeds example: ${bytes.length} bytes; CC-BY-NC-4.0.`);
