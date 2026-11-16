import assert from 'node:assert/strict';
import test from 'node:test';
import { npyBlob, npyForRecords, readEmbeddings } from '../src/embedding-files.js';

const bytesOf = async blob => await blob.arrayBuffer();

test('a .npy written by the app reads back as unit vectors, with empty records left out', async () => {
  const table = new Float32Array([3, 4, 0, 0, 0, 2]);
  const bytes = await bytesOf(npyBlob(table, 3, 2));
  assert.equal(new DataView(bytes).getUint8(0), 0x93);
  assert.equal((bytes.byteLength - table.byteLength) % 64, 0, 'data starts on a 64-byte boundary');
  const { features, dimensions, rowIds } = readEmbeddings(bytes, 'vectors.npy', 3);
  assert.equal(dimensions, 2);
  assert.deepEqual(rowIds, [0, 2]);
  assert.deepEqual([...features].map(value => Number(value.toFixed(3))), [0.6, 0.8, 0, 1]);
});

test('exported vectors keep their table position so they import back unchanged', async () => {
  const features = new Float32Array([1, 0, 0, 1]);
  const bytes = await bytesOf(npyForRecords(features, [0, 3], 2, 4));
  const { rowIds, features: back } = readEmbeddings(bytes, 'again.npy', 4);
  assert.deepEqual(rowIds, [0, 3]);
  assert.deepEqual([...back], [1, 0, 0, 1]);
});

test('raw float32 files take their dimension from the record count', () => {
  const values = new Float32Array([1, 0, 0, 1, 1, 1]);
  const { dimensions, rowIds } = readEmbeddings(values.buffer, 'run.f32', 3);
  assert.equal(dimensions, 2);
  assert.deepEqual(rowIds, [0, 1, 2]);
  assert.throws(() => readEmbeddings(values.buffer, 'run.f32', 4), /whole number of values/);
});

test('a file with the wrong number of records, unsupported type or missing values is refused with a reason', async () => {
  const bytes = await bytesOf(npyBlob(new Float32Array([1, 2, 3, 4]), 2, 2));
  assert.throws(() => readEmbeddings(bytes, 'a.npy', 5), /2 vectors but the table has 5/);
  assert.throws(() => readEmbeddings(new ArrayBuffer(16), 'bad.npy', 2), /Not a NumPy/);
  assert.throws(() => readEmbeddings(new Float32Array([NaN, 1, 1, 1]).buffer, 'nan.f32', 2), /missing or infinite/);
  const integers = new TextEncoder().encode("{'descr': '<i4', 'fortran_order': False, 'shape': (2, 2), }".padEnd(53, ' ') + '\n');
  const header = new Uint8Array(10 + integers.length + 16);
  header.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, integers.length, 0]);
  header.set(integers, 10);
  assert.throws(() => readEmbeddings(header.buffer, 'ints.npy', 2), /float32 or float64/);
});

test('half-precision .npy vectors, the compact form used for the example embeddings, read back to within their precision', () => {
  // 0.5 and -0.25 and 1 as float16 bit patterns, in a version 1.0 header for a 1 x 3 array.
  const header = "{'descr': '<f2', 'fortran_order': False, 'shape': (1, 3), }";
  const text = `${header}${' '.repeat(64 - ((10 + header.length + 1) % 64))}\n`;
  const bytes = new Uint8Array(10 + text.length + 6);
  bytes.set([0x93, 0x4e, 0x55, 0x4d, 0x50, 0x59, 1, 0, text.length, 0]);
  bytes.set(new TextEncoder().encode(text), 10);
  new Uint16Array(bytes.buffer, 10 + text.length, 3).set([0x3800, 0xb400, 0x3c00]);
  const { features } = readEmbeddings(bytes.buffer, 'half.npy', 1);
  const norm = Math.hypot(0.5, 0.25, 1);
  assert.deepEqual([...features].map(value => Number(value.toFixed(4))), [0.5, -0.25, 1].map(value => Number((value / norm).toFixed(4))));
});
