import assert from 'node:assert/strict';
import test from 'node:test';
import { candidateFields, columnKind, columnPayload, fieldGroups } from '../src/compare-columns.js';
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

test('values beyond the palette share a grey Other group, small groups included', () => {
  const many = Array.from({ length: 200 }, (_, id) => ({ kind: `k${id % 10}`, rare: id < 191 ? 'x' : `r${id}` }));
  const manyModel = { rows: many, fields: [field('kind', { kind: 'categorical' }), field('rare', { kind: 'categorical' })] };
  const ids = many.map((_, id) => id);
  const groups = fieldGroups(manyModel, manyModel.fields[0], ids);
  assert.equal(groups.length, 8, 'seven values and Other');
  const other = groups.at(-1);
  assert.equal(other.name, 'Other values');
  assert.equal(other.subset.length, 60, 'three values of twenty records');
  assert.equal(groups[0].comparison.length, 180);
  const rare = fieldGroups(manyModel, manyModel.fields[1], ids);
  assert.deepEqual(rare.map(group => group.name), ['x']);
  assert.equal(rare.length, 1, 'nine singletons are fewer than a group, so no Other');
});

test('a cluster column keeps the colours and the order of its legend, not the order of its sizes', () => {
  const rows = Array.from({ length: 60 }, (_, id) => ({ cluster: id < 40 ? 'zorg' : 'school' }));
  const results = { get: id => (id === 'r1' ? { groups: { 0: { name: 'school', color: '#111111' }, 1: { name: 'zorg', color: '#222222' } } } : null) };
  const clusterModel = { rows, results, fields: [field('cluster', { kind: 'categorical', derived: 'r1' })] };
  const groups = fieldGroups(clusterModel, clusterModel.fields[0], rows.map((_, id) => id));
  assert.deepEqual(groups.map(group => [group.name, group.color]), [['school', '#111111'], ['zorg', '#222222']]);
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

test('strength dots are absolute bands of explained variation, and nothing is shown for insignificant columns', async () => {
  const { dots } = await import('../src/compare-by.js');
  const column = (effect, significant = true) => ({ effect, significant });
  assert.equal(dots(column(0.015)), '●○○', 'the weak DBRD sentiment effect is not three dots');
  assert.equal(dots(column(0.05)), '●●○');
  assert.equal(dots(column(0.15)), '●●●');
  assert.equal(dots(column(0.5, false)), '○○○');
  assert.equal(dots(undefined), '○○○');
});
