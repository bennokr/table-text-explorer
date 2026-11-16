import assert from 'node:assert/strict';
import test from 'node:test';
import { displayFields, populationTooltip } from '../src/term-display.js';
import { comparisonSets } from '../src/term-view.js';

test('combined clouds preserve duplicate phrases as independently scored field predicates', () => {
  const fields = ['title', 'body'].map((name, index) => ({ name, vocabulary: 10,
    terms: [{ phrase: 'care', support: index + 1, frequency: .5 }] }));
  const [combined] = displayFields(fields, true);
  assert.deepEqual(combined.terms.map(term => term.field), ['title', 'body']);
  assert.deepEqual(combined.terms.map(term => term.support), [1, 2]);
  assert.notEqual(combined.terms[0].color, combined.terms[1].color);
  assert.equal(combined.vocabulary, 20);
  assert.equal(displayFields(fields, false), fields);
  assert.equal(fields[0].terms[0].field, undefined);
});

test('visible and filtered scopes remain explicit; empty selection describes visible records', () => {
  const model = { rows: Array(4).fill({}), visible: [1, 3], selected: new Set() };
  assert.deepEqual(comparisonSets(model, 'selection'), { subset: [1, 3], comparison: [] });
  assert.deepEqual(comparisonSets(model, 'filtered'), { subset: [1, 3], comparison: [0, 2] });
  model.selected.add(1);
  assert.deepEqual(comparisonSets(model, 'visible'), { subset: [1, 3], comparison: [] });
  assert.deepEqual(comparisonSets(model, 'selection'), { subset: [1], comparison: [3] });
});

test('partition evidence distinguishes scored text coverage from all-record coverage', () => {
  const term = { partitionSupport: 3, population: 4, semantic: .5 };
  assert.match(populationTooltip(term, 'semantic'), /3\/4 \(75%\).*1 \(25%\).*50/);
  assert.doesNotMatch(populationTooltip(term, 'frequency'), /Semantic/);
});

test('the ranking hint explains each ranking and follows the type of predicate', async () => {
  const { rankingHelp } = await import('../src/ranking-help.js');
  assert.match(rankingHelp('semantic'), /Semantic splits/);
  assert.match(rankingHelp('auto', 'facets'), /predicates/);
  assert.match(rankingHelp('auto', 'phrases'), /phrases/);
  assert.match(rankingHelp('balanced', 'facets'), /yes\/no question/);
  assert.equal(rankingHelp('unknown'), rankingHelp('auto'));
});
