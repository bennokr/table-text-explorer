import assert from 'node:assert/strict';
import test from 'node:test';
import { axisGroups, candidateFields, columnKind, columnPayload, fieldGroups, rampColors } from '../src/compare-columns.js';
import { formatQuery } from '../src/query-predicates.js';

const rows = Array.from({ length: 60 }, (_, id) => ({ stars: [1, 2, 4, 5][id % 4], mood: id % 3 === 0 ? 'ja' : 'nee',
  size: id, region: id % 5 === 0 ? null : 'noord' }));
const field = (name, extra) => ({ name, storage: 'string', valueLabels: [], ...extra });
const model = { rows, fields: [field('stars', { kind: 'categorical' }), field('mood', { kind: 'categorical', annotation: true }),
  field('size', { kind: 'number' }), field('region', { kind: 'categorical' }), field('cluster', { kind: 'categorical', derived: 'r1' }),
  field('id', { kind: 'categorical', identifier: true }), field('words', { kind: 'text' })] };
const everyone = rows.map((_, id) => id);

test('candidate columns exclude text and identifiers but include annotations and clusterings', () => {
  assert.deepEqual(candidateFields(model).map(item => item.name), ['stars', 'mood', 'size', 'region', 'cluster']);
  assert.deepEqual(['stars', 'mood', 'cluster'].map(name => columnKind(model.fields.find(item => item.name === name))),
    ['Columns', 'Annotations', 'Clusters']);
});

test('the worker payload marks missing values and aligns them to the population', () => {
  const region = columnPayload(model, model.fields[3], everyone);
  assert.equal(region.kind, 'categorical');
  assert.equal(region.codes.filter(code => code === -1).length, 12);
  const size = columnPayload(model, model.fields[2], [3, 4, 5]);
  assert.deepEqual(size, { name: 'size', kind: 'numeric', values: [3, 4, 5] });
});

test('categorical values become groups compared with the other observed records', () => {
  const groups = fieldGroups(model, model.fields[3], everyone);
  assert.equal(groups.length, 1, 'one value only: nothing to compare');
  const stars = fieldGroups(model, model.fields[0], everyone);
  assert.deepEqual(stars.map(group => group.name), ['1', '2', '4', '5'], 'ordered values keep their order');
  assert.equal(stars[0].subset.length, 15);
  assert.equal(stars[0].comparison.length, 45);
  assert.equal(formatQuery(stars[1].predicate), '"stars"="2"');
});

test('a missing value is not a group and records without a value are not compared with', () => {
  const [group] = fieldGroups(model, model.fields[3], everyone);
  assert.equal(group.subset.length, 48);
  assert.equal(group.comparison.length, 0);
});

test('a number is compared at its extremes with matching click conditions', () => {
  const [low, high] = fieldGroups(model, model.fields[2], everyone);
  assert.equal(formatQuery(low.predicate), '"size"<="14"');
  assert.equal(formatQuery(high.predicate), '"size">"44"');
  assert.ok(low.subset.every(id => !high.subset.includes(id)));
  assert.deepEqual(low.comparison, high.subset);
});

test('a text axis offers its two sides, and ordered colours run from cool to warm', () => {
  const [a, b] = axisGroups({ high: [1, 2], low: [3] });
  assert.deepEqual([a.subset, a.comparison, b.subset, b.comparison], [[1, 2], [3], [3], [1, 2]]);
  const [first, , , last] = rampColors(4);
  assert.notEqual(first, last);
  assert.equal(rampColors(1).length, 1);
});

test('strength dots are absolute bands of explained variation, and nothing is shown for insignificant columns', async () => {
  const { dots } = await import('../src/compare-by.js');
  const column = (effect, significant = true) => ({ effect, significant });
  assert.equal(dots(column(0.015)), '●○○', 'the weak DBRD sentiment effect is not three dots');
  assert.equal(dots(column(0.05)), '●●○');
  assert.equal(dots(column(0.15)), '●●●');
  assert.equal(dots(column(0.5, false)), '○○○');
  assert.equal(dots(undefined), '○○○');
});
