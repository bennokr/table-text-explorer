import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { facetField } from '../src/facet-predicates.js';
import { FacetIndex } from '../src/facet-index.js';
import { formatQuery } from '../src/query-predicates.js';
import { parseQuery } from '../src/query.js';

function assertMatching(field, rows) {
  const result = facetField(field, rows);
  for (const item of result.predicates) {
    const parsed = parseQuery(formatQuery(item.predicate), [field]);
    assert.deepEqual(parsed.ast, item.predicate);
    assert.deepEqual(rows.flatMap((row, id) => parsed.test(row) ? [id] : []), item.ids);
  }
  return result.predicates;
}

test('categorical facet queries preserve exact values, quoting, missing codes and case-insensitive equality', () => {
  const field = { name: 'group "label"', kind: 'categorical', valueLabels: [{ value: 'a*', label: 'Literal star' }],
    missingValues: ['empty'] };
  const values = ['a*', 'ALPHA', 'alpha', 'null', 'NULL', 'empty', null, '', '\\N', 'AND', 'a"b', false, 0];
  const predicates = assertMatching(field, values.map(value => ({ [field.name]: value })));
  assert.equal(predicates.find(item => item.predicate.value === 'a*').label, 'a* · Literal star');
  assert.deepEqual(predicates.find(item => item.predicate.literal).ids, [3, 4]);
  assert.deepEqual(predicates.find(item => item.label === 'Missing').ids, [5, 6, 7, 8]);
});

test('numeric ranges partition usable records once, keep boundary ties and respect metadata missing values', () => {
  const field = { name: 'score', kind: 'number', missingValues: [-99] };
  const rows = [0, 1, 1, 2, 3, 4, 5, 6, 7, null, -99].map(score => ({ score }));
  const predicates = assertMatching(field, rows);
  assert.equal(predicates.length, 6);
  assert.deepEqual(predicates.filter(item => !['Missing', 'Not missing'].includes(item.label)).flatMap(item => item.ids).sort((a, b) => a - b),
    Array.from({ length: 9 }, (_, id) => id));
  assert.deepEqual(predicates.find(item => item.label === 'Missing').ids, [9, 10]);
  assert.equal(facetField(field, [{ score: 7 }, { score: 7 }]).predicates.length, 0);
});

test('boolean and declared date facets have the same cached and editable-query memberships', () => {
  const booleans = assertMatching({ name: 'active', kind: 'boolean', valueLabels: [] },
    [{ active: true }, { active: false }, { active: null }]);
  assert.deepEqual(booleans.map(item => item.ids), [[0], [1], [2], [0, 1]]);
  const dates = assertMatching({ name: 'when', kind: 'date', format: '%d/%m/%Y' },
    ['01/01/2026', '02/01/2026', '03/01/2026', '04/01/2026', null].map(when => ({ when })));
  assert.equal(dates.length, 6);
});

test('facet cache is independent of brushes, filters and phrases, but invalidates on edits and worker resets', () => {
  const model = new Dataset();
  const cache = new FacetIndex(model);
  model.load({ name: 'facets', rows: [{ id: 0, group: 'A', text: null }, { id: 1, group: 'B', text: 'hello' }],
    metadata: { group: { kind: 'categorical' }, text: { kind: 'text' } } });
  model.fields.push({ name: 'cluster', kind: 'categorical', derived: true });
  const first = cache.request(0);
  assert.deepEqual(first.fields.map(field => field.name), ['group', 'text']);
  cache.accept(first, 0);
  model.select([0]);
  model.pinned = new Set([0]);
  model.refresh();
  assert.equal(cache.request(0).fields, undefined);
  assert.strictEqual(cache.request(1).fields, first.fields);
  model.addAnnotation('review');
  const edited = cache.request(0);
  assert.notEqual(edited.key, first.key);
  cache.accept(first, 0);
  assert.ok(cache.request(0).fields);
  model.annotate('review', [0], 'yes');
  assert.notEqual(cache.request(0).key, edited.key);
  model.load({ name: 'replacement', rows: [{ fresh: true }, { fresh: false }] });
  assert.deepEqual(cache.request(0).fields.map(field => field.name), ['fresh']);
});
