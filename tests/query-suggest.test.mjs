import assert from 'node:assert/strict';
import test from 'node:test';
import { suggest } from '../src/query-suggest.js';
import { composeQuery, splitQuery } from '../src/query-text.js';

const rows = Array.from({ length: 30 }, (_, id) => ({ party: ['SP', 'VVD', 'D66'][id % 3], year: 2018 + (id % 5),
  text: id % 2 ? 'onderzoek naar zorg voor kinderen' : 'verbod op vuurwerk', note: id % 4 ? 'x' : null }));
const field = (name, kind, extra = {}) => ({ name, kind, valueLabels: [], unique: [], missing: 0, ...extra });
const model = { revision: 1, rows, fields: [field('party', 'categorical'), field('year', 'number'),
  field('text', 'text', { unique: rows.map(row => row.text) }), field('note', 'categorical', { missing: 8 }), field('gone', 'empty')] };

test('an empty draft lists the columns with their types, and typing narrows them', () => {
  const all = suggest(model, '').items;
  assert.deepEqual(all.map(item => item.label), ['party', 'year', 'text', 'note']);
  assert.equal(all[1].hint, 'number');
  assert.deepEqual(suggest(model, 'ye').items.map(item => item.label), ['year']);
  assert.equal(suggest(model, 'ye').items[0].draft, 'year ', 'picking a column leaves room for the operator');
});

test('after a column come the operators that fit its type, then its values with counts', () => {
  assert.deepEqual(suggest(model, 'party ').items.map(item => item.label), ['=', '!=']);
  assert.deepEqual(suggest(model, 'year ').items.map(item => item.label), ['=', '>', '>=', '<', '<=', '!=']);
  assert.deepEqual(suggest(model, 'text ').items.map(item => item.label), ['~', ':']);
  assert.deepEqual(suggest(model, 'year >').items.map(item => item.label), ['>', '>=']);
  const values = suggest(model, 'party=').items;
  assert.deepEqual(values.map(item => [item.label, item.hint]), [['SP', '10 records'], ['VVD', '10 records'], ['D66', '10 records']]);
  assert.equal(values[0].done, true);
  assert.equal(values[0].draft, 'party=SP');
  assert.deepEqual(suggest(model, 'party="V').items.map(item => item.label), ['VVD']);
});

test('missing values, phrases from the text and numbers are suggested sensibly', () => {
  assert.ok(suggest(model, 'note=').items.some(item => item.label === 'null' && item.hint === '8 missing'));
  const words = suggest(model, 'text~ver').items.map(item => item.label);
  assert.deepEqual(words, ['verbod']);
  assert.match(suggest(model, 'year>=').message, /Type a number/);
  assert.equal(suggest(model, 'text~"qq').items.length, 0);
});

test('chips and the draft make one query, and a query splits back into chips', () => {
  assert.equal(composeQuery([], 'a:b'), 'a:b');
  assert.equal(composeQuery(['"x"="1"', '"y"="2"'], ''), '"x"="1" AND "y"="2"');
  assert.equal(composeQuery(['"x"="1"'], 'a OR b'), '"x"="1" AND (a OR b)');
  const { nodes, draft } = splitQuery('party=SP AND NOT year>2019', model.fields);
  assert.equal(nodes.length, 2);
  assert.equal(draft, '');
  assert.deepEqual(splitQuery('party=SP AND', model.fields), { nodes: [], draft: 'party=SP AND' });
  assert.deepEqual(splitQuery('  ', model.fields), { nodes: [], draft: '' });
});
