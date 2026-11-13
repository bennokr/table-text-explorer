import assert from 'node:assert/strict';
import test from 'node:test';
import { lexiconFrom, parseFold, parseWords } from '../src/lexicon-parse.js';
import { loadLexicon } from './lexicon-files.mjs';

const languages = loadLexicon();

test('every language has all four files, with plain lowercase single words', () => {
  assert.deepEqual(Object.keys(languages).sort(), ['en', 'nl']);
  for (const [code, lexicon] of Object.entries(languages)) {
    for (const kind of ['stop', 'lead', 'negation']) {
      assert.ok(lexicon[kind].length > 5, `${code}/${kind} has entries`);
      for (const word of lexicon[kind]) { assert.match(word, /^[\p{L}']+$/u, `${code}/${kind}: ${word}`); }
      assert.equal(new Set(lexicon[kind]).size, lexicon[kind].length, `${code}/${kind} has no duplicates`);
    }
    assert.ok(lexicon.fold.rules.length > 5, `${code} has folding rules`);
  }
});

test('a word is in one tier only, and negations are not stopwords', () => {
  for (const [code, lexicon] of Object.entries(languages)) {
    const tiers = ['stop', 'lead', 'negation'];
    for (const [first, second] of [[0, 1], [0, 2], [1, 2]]) {
      const shared = lexicon[tiers[first]].filter(word => lexicon[tiers[second]].includes(word));
      assert.deepEqual(shared, [], `${code}: ${tiers[first]} and ${tiers[second]} share words`);
    }
  }
  assert.ok(languages.nl.negation.includes('niet') && languages.nl.negation.includes('geen'));
  assert.ok(languages.nl.stop.includes('deze') && languages.nl.stop.includes('of'));
  assert.ok(languages.nl.lead.includes('zonder'));
});

test('fold rules are well formed: a suffix, a replacement and a number', () => {
  for (const [code, { fold }] of Object.entries(languages)) {
    for (const [suffix, replacement, minimum] of fold.rules) {
      assert.match(suffix, /^[\p{L}']+$/u, `${code}: ${suffix}`);
      assert.equal(typeof replacement, 'string');
      assert.ok(Number.isInteger(minimum) && minimum >= 0, `${code}: ${suffix} has a minimum`);
    }
  }
  assert.deepEqual(parseFold('@undouble # doubled\nen - 3\nheden heid 2'), { collapse: false, undouble: true, dropE: false,
    rules: [['en', '', 3], ['heden', 'heid', 2]] });
  assert.deepEqual(parseWords('De # article\n\n  HET\n'), ['de', 'het']);
});

test('a language choice, two languages and the user\'s extra stopwords make one lexicon', () => {
  const both = lexiconFrom(languages, { language: 'nl,en', stopwords: 'Prima, kassa' });
  assert.ok(['de', 'the', 'prima', 'kassa'].every(word => both.stop.includes(word)));
  assert.deepEqual(both.fold, languages.nl.fold, 'two languages use the first one\'s folding');
  const none = lexiconFrom(languages, { language: 'none', stopwords: '' });
  assert.deepEqual([none.stop, none.lead, none.negation, none.fold], [[], [], [], null]);
});
