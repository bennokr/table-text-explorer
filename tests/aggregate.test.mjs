import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, automaticBins, categories, countsFor } from '../src/aggregate.js';

const field = name => ({ name, kind: 'categorical', valueLabels: [] });
const rows = values => values.map(value => ({ year: value, group: 'g' }));

test('numeric and date-like values read in ascending order, other values by count', () => {
  const years = rows([2024, 2024, 2024, 2017, 2023, 2023]);
  assert.deepEqual(categories(years, field('year')).labels, ['2017', '2023', '2024']);
  const months = rows(['2024-03', '2024-01', '2024-01', '2024-02']);
  assert.deepEqual(categories(months, field('year')).labels, ['2024-01', '2024-02', '2024-03']);
  const names = rows(['b', 'a', 'a', 'c', 'a', 'b']);
  assert.deepEqual(categories(names, field('year')).labels, ['a', 'b', 'c']);
  const mixed = rows(['x', 'y', 'y', 'y', 'z', 'z']);
  assert.deepEqual(categories(mixed, field('year')).labels, ['y', 'z', 'x']);
});

test('missing values come last in reading order', () => {
  const data = rows([3, null, 1, 1, null, null, 2]);
  assert.deepEqual(categories(data, field('year')).labels, ['1', '2', '3', '(missing)']);
});

test('the biggest values are kept and the rest become Other, in reading order', () => {
  const data = rows([1, 1, 1, 2, 2, 3, 4, 5]);
  const result = categories(data, field('year'), 3);
  assert.deepEqual(result.labels, ['1', '2', '3', 'Other']);
  assert.equal(result.codes[6], 3);
  assert.equal(result.codes[7], 3);
});

test('one value too many is shown rather than merged into Other', () => {
  const data = rows([1, 1, 1, 2, 2, 3, 4]);
  assert.deepEqual(categories(data, field('year'), 3).labels, ['1', '2', '3', '4']);
});

test('a bar chart lists its first value at the top', () => {
  const groups = aggregate(rows([2017, 2018]), [field('year')]);
  assert.deepEqual(groups.yLabels, ['2018', '2017']);
  assert.deepEqual(groups.data.y, [1, 0]);
});

test('stacked bars cut each bar by the stack column and place segments end to end', () => {
  const data = [{ kind: 'a', part: 'p' }, { kind: 'a', part: 'q' }, { kind: 'a', part: 'q' }, { kind: 'b', part: 'p' }];
  const stack = { field: field('part'), colorOf: value => (value === 'p' ? '#111111' : '#222222') };
  const groups = aggregate(data, [field('kind')], { stack });
  assert.equal(groups.kind, 'stacked');
  assert.deepEqual(groups.data.color, ['#111111', '#222222', '#111111', '#222222']);
  const model = { visible: [0, 1, 2, 3], selected: new Set([1]) };
  const counts = countsFor(groups, model);
  assert.deepEqual(counts.count, [1, 2, 1, 0]);
  assert.deepEqual(counts.left, [0, 1, 0, 1]);
  assert.deepEqual(counts.right, [1, 3, 1, 1]);
  assert.deepEqual(counts.stripRight, [0, 2, 0, 1]);
});

test('histogram bins follow the setting, or Sturges when automatic', () => {
  const numbers = Array.from({ length: 100 }, (_, index) => ({ score: index }));
  const score = { name: 'score', kind: 'number' };
  assert.equal(aggregate(numbers, [score]).members.length, automaticBins(100));
  assert.equal(aggregate(numbers, [score], { bins: 7 }).members.length, 7);
  assert.equal(automaticBins(2), 5);
  assert.equal(automaticBins(10 ** 9), 30);
});
