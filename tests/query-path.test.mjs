import assert from 'node:assert/strict';
import test from 'node:test';
import { chipLabel, conjuncts, coveredByPath, negation, withoutConjunct } from '../src/query-path.js';
import { appendPredicate, formatQuery, phrasePredicate, valuePredicate } from '../src/query-predicates.js';

const phrase = phrasePredicate('text', 'staande voet');
const facet = valuePredicate('court', 'Rechtbank');

test('a query is a path of AND-ed conditions that can be taken apart and rebuilt', () => {
  const query = appendPredicate(appendPredicate(null, phrase), facet);
  assert.deepEqual(conjuncts(query).map(formatQuery), [formatQuery(phrase), formatQuery(facet)]);
  assert.equal(formatQuery(withoutConjunct(query, 0)), formatQuery(facet));
  assert.equal(withoutConjunct(phrase, 0), null);
  assert.deepEqual(conjuncts(null), []);
});

test('clicking the opposite of a condition flips it instead of contradicting it', () => {
  const query = appendPredicate(phrase, facet);
  const flipped = appendPredicate(query, negation(facet));
  assert.deepEqual(conjuncts(flipped).map(formatQuery), [formatQuery(phrase), formatQuery(negation(facet))]);
  const back = appendPredicate(flipped, facet);
  assert.deepEqual(conjuncts(back).map(formatQuery), [formatQuery(phrase), formatQuery(facet)]);
  assert.strictEqual(appendPredicate(query, facet), query);
});

test('chips are readable', () => {
  assert.equal(chipLabel(phrase), 'text contains staande voet');
  assert.equal(chipLabel(negation(facet)), 'NOT court = Rechtbank');
});

test('a conditioned cloud hides the conditions and their nested phrases, but nothing else', () => {
  const path = conjuncts(appendPredicate(phrasePredicate('text', 'voet'), negation(facet)));
  const hidden = (term, field = 'text') => coveredByPath(term, field, path);
  assert.ok(hidden({ phrase: 'voet' }));
  assert.ok(hidden({ phrase: 'staande voet' }), 'a phrase containing the condition');
  assert.ok(hidden({ phrase: 'ontslag op staande voet' }));
  assert.ok(!hidden({ phrase: 'ontslag' }));
  assert.ok(!hidden({ phrase: 'voet' }, 'summary'), 'other fields are unaffected');
  assert.ok(hidden({ phrase: 'Rechtbank', predicate: facet }, 'court'), 'a facet condition, even negated');
  assert.ok(!hidden({ phrase: 'Hof', predicate: valuePredicate('court', 'Hof') }, 'court'));
});
