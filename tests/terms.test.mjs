import assert from 'node:assert/strict';
import test from 'node:test';
import { comparisonSets } from '../src/term-view.js';
import { lexiconFrom } from '../src/lexicon-parse.js';
import { loadLexicon } from './lexicon-files.mjs';
import { phraseSettings, retainPhraseSettings } from '../src/phrase-config.js';
import { Dataset } from '../src/state.js';

test('subset descriptions use disjoint comparisons and intersect selections with visible records', () => {
  const model = { rows: Array(6).fill({}), visible: [4, 1, 3], selected: new Set([0, 1, 4]) };
  assert.deepEqual(comparisonSets(model, 'selection'), { subset: [4, 1], comparison: [3] });
  assert.deepEqual(comparisonSets(model, 'filtered'), { subset: [4, 1, 3], comparison: [0, 2, 5] });
  assert.deepEqual([...model.selected], [0, 1, 4]);
});

test('negations are never stopwords, and explicit additional stopwords are respected', () => {
  const languages = loadLexicon();
  const stop = config => lexiconFrom(languages, config).stop;
  assert.ok(!stop({ language: 'nl', stopwords: '' }).includes('niet'));
  assert.ok(stop({ language: 'nl', stopwords: 'NIET,prima' }).includes('niet'));
  assert.ok(stop({ language: 'nl', stopwords: '' }).includes('deze'));
});

test('independent map columns do not change the retained shared phrase selection', () => {
  const model = new Dataset();
  model.load({ name: 'shared', rows: [{ text: 'first text', notes: 'other text' }] });
  const original = phraseSettings(model);
  retainPhraseSettings(model);
  model.configure({ ...model.config, mode: 'sentences', features: ['notes'] });
  assert.deepEqual(phraseSettings(model), original);
  const saved = model.phraseConfig;
  retainPhraseSettings(model);
  assert.strictEqual(model.phraseConfig, saved);
});
