import assert from 'node:assert/strict';
import test from 'node:test';
import { byteTotal, readBytes } from '../src/workers/assets.js';
import { percent } from '../src/status.js';

test('an encoded response has no usable byte total', () => {
  assert.equal(byteTotal(new Headers({ 'content-length': '1000' })), 1000);
  assert.equal(byteTotal(new Headers({ 'content-length': '1000', 'content-encoding': 'identity' })), 1000);
  assert.equal(byteTotal(new Headers({ 'content-length': '300', 'content-encoding': 'gzip' })), 0);
  assert.equal(byteTotal(new Headers()), 0);
});

test('reading a gzip-compressed response never reports more than its total', async () => {
  const body = new Uint8Array(5000).fill(97);
  const compressed = new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'));
  const encoded = await new Response(compressed).arrayBuffer();
  const response = new Response(new Blob([encoded]).stream().pipeThrough(new DecompressionStream('gzip')),
    { headers: { 'content-length': String(encoded.byteLength), 'content-encoding': 'gzip' } });
  const reports = [];
  const bytes = await readBytes(response, update => reports.push(update));
  assert.equal(bytes.length, 5000);
  assert.ok(reports.length > 0);
  assert.ok(reports.every(update => update.total === 0), 'indeterminate, not a wrong total');
});

test('percent is clamped to 0..100 and absent without a total', () => {
  assert.equal(percent({ completed: 50, total: 200 }), 25);
  assert.equal(percent({ completed: 300, total: 200 }), 100);
  assert.equal(percent({ completed: -5, total: 200 }), 0);
  assert.equal(percent({ completed: 5, total: 0 }), null);
  assert.equal(percent({ message: 'x' }), null);
});
