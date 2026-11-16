import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detect, fieldLanguages, languageNote, languageSettings } from '../src/language.js';
import { inferSchema } from '../src/schema.js';
import { Dataset } from '../src/state.js';

const reviews = JSON.parse(await readFile(new URL('../examples/dbrd-test.json', import.meta.url), 'utf8')).slice(0, 60);
const english = Array.from({ length: 12 }, (_, i) => ({
  review: `The story drags a little in the middle, but the ending is worth the wait and the characters feel real (${i}).`,
  sex: i % 2 ? 'male' : 'female',
}));

test('detect names the language of a text and is silent about words it cannot place', () => {
  assert.equal(detect('Het verhaal sleept een beetje in het midden, maar het einde is het wachten waard.'), 'nl');
  assert.equal(detect('The story drags a little in the middle, but the ending is worth the wait.'), 'en');
  assert.equal(detect('ja'), null);
  assert.equal(detect('NL'), null);
});

test('a text column gets its language by the linked-codebook protocol; categorical columns get none', () => {
  const fields = inferSchema(english);
  assert.deepEqual(fields.map(field => field.kind), ['text', 'categorical']);
  assert.deepEqual(fieldLanguages(fields, english), { review: 'en' });
});

test('the language of Dutch reviews is Dutch', () => {
  const fields = inferSchema(reviews);
  assert.equal(fieldLanguages(fields, reviews).text, 'nl');
});

test('a language in the column metadata wins over detection', () => {
  const fields = inferSchema(english);
  assert.deepEqual(fieldLanguages(fields, english, { review: { language: 'de' } }), { review: 'de' });
});

test('settings follow the languages found, and stay put when there are none', () => {
  assert.deepEqual(languageSettings({}), {});
  assert.deepEqual(languageSettings({ a: 'en' }), { language: 'en', vectorLanguage: 'en' });
  assert.deepEqual(languageSettings({ a: 'nl', b: 'en' }), { language: 'nl,en', vectorLanguage: 'nl' });
  assert.deepEqual(languageSettings({ a: 'en', b: 'nl' }), { language: 'nl,en', vectorLanguage: 'en' });
  assert.deepEqual(languageSettings({ a: 'de' }), { language: 'none' });
  assert.deepEqual(languageSettings({ a: 'de', b: 'nl' }), { language: 'nl', vectorLanguage: 'nl' });
});

test('the note says which languages have no stoplist or vector model', () => {
  assert.equal(languageNote({}), '');
  assert.equal(languageNote({ a: 'nl' }), 'text language: nl');
  assert.equal(languageNote({ a: 'nl', b: 'de' }), 'text language: nl, de (no stoplist or vector model for de)');
});

test('loading a table sets the stoplist and vector model from its text, and records the languages', () => {
  const dataset = new Dataset();
  dataset.load({ rows: english, name: 'english' });
  assert.equal(dataset.config.language, 'en');
  assert.equal(dataset.config.vectorLanguage, 'en');
  assert.deepEqual(dataset.languages, { review: 'en' });
  const numbers = new Dataset();
  numbers.load({ rows: Array.from({ length: 12 }, (_, i) => ({ id: i, age: 20 + i % 5 })), name: 'numbers' });
  assert.equal(numbers.config.language, 'nl', 'the defaults stay when no column has a language');
  assert.equal(numbers.languageNote, '');
});

test('identifier names come from linked-codebook', () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ patient_id: `p${i}`, valid: i % 2 ? 'a' : 'b' }));
  const [patient, valid] = inferSchema(rows);
  assert.equal(patient.identifier, true);
  assert.equal(valid.identifier, false);
});
