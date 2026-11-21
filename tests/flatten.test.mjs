import assert from 'node:assert/strict';
import test from 'node:test';
import { flatTable, flattenRecords, isNested } from '../src/flatten.js';
import { parseTable } from '../src/table-readers.js';

test('objects become dotted paths and the strings of a list are merged one per line', () => {
  const rows = [{ id: 1, a: { b: [{ c: 'foo', d: 1 }, { c: 'bar' }], e: 'x' } }, { id: 2, a: { b: [], e: null } }];
  const flat = flattenRecords(rows);
  assert.deepEqual(flat.rows, [{ id: 1, 'a.b.c': 'foo\nbar', 'a.b.d': 1, 'a.e': 'x' },
    { id: 2, 'a.b.c': null, 'a.b.d': null, 'a.e': null }]);
  assert.deepEqual(flat.columns.map(column => [column.path, column.kind, column.filled]),
    [['id', 'value', 2], ['a.b.c', 'merged text', 1], ['a.b.d', 'value', 1], ['a.e', 'value', 1]]);
});

test('lists of numbers have no flat form and are reported, not merged into a string', () => {
  const flat = flattenRecords([{ id: 1, scores: [1, 2] }, { id: 2, scores: [3] }]);
  assert.deepEqual(flat.skipped, ['scores']);
  assert.deepEqual(flat.rows, [{ id: 1 }, { id: 2 }]);
});

test('an object whose keys differ between records is read as the list of its keys', () => {
  const phrase = (record, count) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`phrase ${record}-${index}`, 0.5]));
  const rows = Array.from({ length: 4 }, (_, record) => ({ pros: phrase(record, 10), mixed: { yes: 1 } }));
  const flat = flattenRecords(rows);
  assert.equal(flat.rows[1].pros.split('\n').length, 10);
  assert.equal(flat.columns.find(column => column.path === 'pros').kind, 'keys');
  assert.equal(flat.rows[0]['mixed.yes'], 1);
});

test('nested JSON files carry a flat version beside the original read; flat files carry none', () => {
  const nested = parseTable(new TextEncoder().encode(JSON.stringify([{ id: 1, a: { b: 'x' } }])), 'n.json');
  assert.deepEqual(nested.ignoredFields, ['a']);
  assert.deepEqual(nested.flattened.rows, [{ id: 1, 'a.b': 'x' }]);
  assert.equal(parseTable(new TextEncoder().encode('[{"id":1}]'), 'f.json').flattened, undefined);
  assert.equal(isNested([{ id: 1 }]), false);
  const table = flatTable(nested);
  assert.equal(table.flattened, undefined);
  assert.deepEqual(table.rows, [{ id: 1, 'a.b': 'x' }]);
});

test('a .jsonl file is read as one record per line, blank lines skipped, and errors name the line', () => {
  const read = text => parseTable(new TextEncoder().encode(text), 'reviews.jsonl');
  assert.deepEqual(read('{"id":1,"a":{"b":"x"}}\r\n\n{"id":2}\n').rows.length, 2);
  assert.deepEqual(read('{"id":1,"a":{"b":"x"}}\n{"id":2}').flattened.rows, [{ id: 1, 'a.b': 'x' }, { id: 2, 'a.b': null }]);
  assert.throws(() => read('{"id":1}\n{oops}\n'), /line 2/u);
  assert.throws(() => read('[1,2]\n'), /record objects/u);
});
