import assert from 'node:assert/strict';
import test from 'node:test';
import { linearMethod, mapMethod, methodChoice } from '../src/map-method.js';
import { defaultInputMode } from '../src/default-config.js';
import { defaultSentenceModel } from '../src/sentence-models.js';

test('the linear projection method is chosen from the input mode, never asked', () => {
  for (const mode of ['table', 'text', 'words', 'sentences']) { assert.equal(linearMethod(mode), 'pca'); }
  assert.equal(linearMethod('unknown'), 'pca');
  assert.equal(mapMethod('linear', 'text'), 'pca');
  assert.equal(mapMethod('umap', 'text'), 'umap');
});

test('stored methods map back to the two form choices', () => {
  assert.equal(methodChoice('umap'), 'umap');
  assert.equal(methodChoice('pca'), 'linear');
  assert.equal(methodChoice('svd'), 'linear');
});

test('text columns default to TF-IDF, other tables to the table input', () => {
  const text = { kind: 'text' };
  assert.equal(defaultInputMode([{ kind: 'number' }, text]), 'text');
  assert.equal(defaultInputMode([{ kind: 'number' }, { kind: 'categorical' }]), 'table');
  for (const excluded of [{ identifier: true }, { annotation: true }, { derived: true }]) {
    assert.equal(defaultInputMode([{ ...text, ...excluded }]), 'table');
  }
  assert.equal(defaultInputMode([]), 'table');
});

test('Dutch text defaults to the Dutch sentence model, other languages to the multilingual one', () => {
  assert.equal(defaultSentenceModel('nl'), 'dutch');
  assert.equal(defaultSentenceModel('en'), 'multilingual');
  assert.equal(defaultSentenceModel('nl,en'), 'multilingual');
});
