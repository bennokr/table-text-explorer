import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudWords } from '../src/phrase-cloud.js';

test('cloud sizes compress large score ranges without splitting phrases or changing scores', () => {
  const terms = [0, 1e-9, .1, 1].map(contrast => ({ phrase: 'kleur komt overeen', contrast }));
  const words = cloudWords(terms, 'contrast');
  assert.ok(words.every(word => word.size >= 12 && word.size <= 28));
  assert.ok(words.every((word, index) => !index || word.size >= words[index - 1].size));
  assert.ok(words[2].size > 13.6);
  assert.equal(words[3].size, 28);
  assert.ok(words.every((word, index) => word.text === terms[index].phrase && word.term === terms[index]));
});

test('cloud sizes handle empty, zero and signed rankings and follow the chosen score', () => {
  assert.deepEqual(cloudWords([], 'lift'), []);
  assert.ok(cloudWords([{ phrase: 'stil', lift: 0 }], 'lift').every(word => Number.isFinite(word.size)));
  const terms = [{ phrase: 'stil', lift: -3, ctfidf: 2 }, { phrase: 'lawaai', lift: -1, ctfidf: 1 }];
  const lift = cloudWords(terms, 'lift');
  const ctfidf = cloudWords(terms, 'ctfidf');
  assert.ok(lift[1].size > lift[0].size);
  assert.ok(ctfidf[0].size > ctfidf[1].size);
});
