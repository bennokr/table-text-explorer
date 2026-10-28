import assert from 'node:assert/strict';
import test from 'node:test';
import { inferSchema, numberOf } from '../src/schema.js';
import { Dataset } from '../src/state.js';
import { parseQuery } from '../src/query.js';
import { aggregate, countsFor } from '../src/aggregate.js';
import { dateNumber } from '../src/dates.js';
import { featureFields } from '../src/features.js';

test('schema distinguishes IDs, low-cardinality categories, continuous values, dates and missing cells', () => {
  const rows = Array.from({ length: 20 }, (_, id) => ({ id: id + 1, rating: id % 5,
    value: id * 2.7, group: id % 2 ? 'A' : 'B', postal: `0${id + 100}`,
    date: `2026-10-${String(id + 1).padStart(2, '0')}`, absent: null }));
  const fields = Object.fromEntries(inferSchema(rows).map(field => [field.name, field]));
  assert.equal(fields.id.kind, 'number');
  assert.equal(fields.rating.kind, 'categorical');
  assert.equal(fields.value.kind, 'number');
  assert.equal(fields.group.kind, 'categorical');
  assert.equal(fields.postal.kind, 'text');
  assert.equal(fields.date.kind, 'date');
  assert.equal(fields.absent.kind, 'empty');
  assert.equal(fields.absent.missing, 20);
});

test('query precedence, quoted fields, nulls and prefixes', () => {
  const rows = [{ age: 22, 'full name': 'Anne Brown', note: null },
    { age: 40, 'full name': 'Bob Smith', note: 'care' },
    { age: 55, 'full name': 'Anna Rose', note: '' }];
  const fields = inferSchema(rows);
  const query = input => rows.filter(parseQuery(input, fields).test);
  assert.equal(query('age>=30 AND ("full name":Anna OR note=care)').length, 2);
  assert.equal(query('NOT note:null').length, 1);
  assert.equal(query('"full name":Ann*').length, 2);
  assert.equal(query('age=22 OR age=40 AND note:null').length, 1);
  assert.equal(query('AGE>=40').length, 2);
  assert.throws(() => query('age>='));
  assert.throws(() => query('(age>=22'));
  assert.throws(() => query('unknown:value'));
});

test('date detection handles dotted Dutch dates and rejects impossible calendar days', () => {
  assert.equal(dateNumber('27.01.1989'), Date.UTC(1989, 0, 27));
  assert.equal(dateNumber('2026-10-23'), Date.UTC(2026, 9, 23));
  assert.ok(Number.isNaN(dateNumber('2026-02-30')));
  assert.ok(Number.isNaN(dateNumber('31.02.2026')));
  const fields = inferSchema([{ date: '27.01.1989' }, { date: '01.12.1990' }]);
  assert.equal(fields[0].kind, 'date');
});

test('filtering and schema changes preserve fitted coordinates and manual annotations', () => {
  const rows = [{ id: 1, age: 20 }, { id: 2, age: 30 }, { id: 3, age: 40 }];
  const model = new Dataset();
  model.load({ rows, name: 'test' });
  const coordinates = model.results.add('projection', { fitted: true, x: { values: [1, 2, 3] } });
  model.views = [{ id: 'example', type: 'map', resultId: coordinates.id }];
  model.addAnnotation('review');
  model.annotate('review', [0, 2], 'Keep');
  assert.ok(featureFields(model).every(field => field.name !== 'review'));
  model.select([0, 2]);
  model.pinned = new Set(model.selected);
  model.refresh();
  model.select([1]);
  assert.deepEqual(model.visible, [0, 2]);
  assert.equal(model.rows[0].review, 'Keep');
  assert.equal(rows[0].review, undefined);
  model.configure({ ...model.config, categoryLimit: 4 });
  assert.equal(model.resultFor(model.views[0]), coordinates);
  assert.equal(model.rows[2].review, 'Keep');
  assert.throws(() => model.addAnnotation('age'));
});

test('category and histogram groups map visible selections back to stable row IDs', () => {
  const model = new Dataset();
  model.load({ name: 'test', rows: [{ group: 'A', score: 1 },
    { group: 'A', score: null }, { group: 'B', score: 8 }, { group: 'B', score: 10 }] });
  const groups = aggregate(model.rows, [model.fields[0]]);
  model.visible = [1, 2, 3];
  model.selected = new Set([0, 2]);
  const counts = countsFor(groups, model);
  assert.deepEqual(counts.count, [1, 2]);
  assert.deepEqual(counts.selected, [0, 1]);
  const histogram = aggregate(model.rows, [{ name: 'score', kind: 'number' }]);
  assert.deepEqual(histogram.absent, [1]);
  assert.deepEqual(histogram.members.flat().sort(), [0, 2, 3]);
});

test('prototype-like column names stay data and do not alter object prototypes', () => {
  const row = JSON.parse('{"__proto__":"label","constructor":"text","id":1}');
  const model = new Dataset();
  model.load({ rows: [row], name: 'edge' });
  assert.equal(Object.getPrototypeOf(model.rows[0]), null);
  assert.equal(model.rows[0].__proto__, 'label');
  assert.equal(model.rows[0].constructor, 'text');
  assert.ok(model.fields.every(field => typeof field.kind === 'string'));
});

test('analysis settings retain the schema and emit only a config change', () => {
  const model = new Dataset();
  model.load({ name: 'settings', rows: [{ value: 1 }] });
  const fields = model.fields;
  const events = [];
  for (const type of ['schema', 'view', 'config']) { model.on(type, () => events.push(type)); }
  model.configure({ ...model.config, neighbors: 4, mode: 'text' });
  assert.equal(model.fields, fields);
  assert.deepEqual(events, ['config']);
  model.configure({ ...model.config, overrides: { value: 'text' } });
  assert.equal(model.fields[0].kind, 'text');
  assert.deepEqual(events, ['config', 'schema', 'view']);
});

test('bulk annotation initialization produces one schema/view update and complete field statistics', () => {
  const model = new Dataset();
  model.load({ name: 'labels', rows: [{ value: 1 }, { value: 2 }, { value: 3 }] });
  const events = [];
  for (const type of ['schema', 'view', 'annotation']) { model.on(type, () => events.push(type)); }
  model.addAnnotation('copied', new Map([[0, 'Camera'], [2, 'Battery']]));
  assert.deepEqual(model.rows.map(row => row.copied), ['Camera', null, 'Battery']);
  assert.deepEqual(model.fields.at(-1).unique, ['Camera', 'Battery']);
  assert.equal(model.fields.at(-1).missing, 1);
  assert.deepEqual(events, ['schema', 'view']);
});

test('result edits avoid schema/annotation/view-card broadcasts and colors avoid row refresh', () => {
  const model = new Dataset();
  model.load({ name: 'results', rows: [{ value: 1 }] });
  const events = [];
  for (const type of ['schema', 'view', 'views', 'annotation', 'results']) { model.on(type, () => events.push(type)); }
  model.resultsChanged();
  assert.deepEqual(events, ['results', 'view']);
  events.length = 0;
  model.resultsChanged({ valuesChanged: false });
  assert.deepEqual(events, ['results']);
});

test('sparse strings and repeated prose stay text without dataset-specific name rules', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    brief: i === 0 ? 'An unusual answer' : null,
    paragraph: 'This is a repeated sentence with enough words to be prose rather than a category.',
    group: i % 2 ? 'First group' : 'Second group',
  }));
  const fields = inferSchema(rows);
  assert.deepEqual(fields.map(field => field.kind), ['text', 'text', 'categorical']);
});

test('datetime inference, validation and numeric conversion preserve time rather than date alone', () => {
  const rows = [{ when: '2026-10-28 09:30:00 UTC' }, { when: '2026-10-28T12:00:00+02:00' }];
  const field = inferSchema(rows)[0];
  assert.equal(field.kind, 'datetime');
  assert.equal(dateNumber(rows[0].when), Date.UTC(2026, 9, 28, 9, 30));
  assert.equal(dateNumber(rows[1].when), Date.UTC(2026, 9, 28, 10));
  assert.ok(Number.isNaN(dateNumber('2026-02-30T12:00:00Z')));
  assert.ok(Number.isNaN(dateNumber('2026-10-28T25:00:00Z')));
  assert.equal(numberOf('29/08/2025 12:50:55', { kind: 'datetime', format: '%d/%m/%Y %H:%M:%S' }), Date.UTC(2025, 7, 29, 12, 50, 55));
  assert.equal(rows.filter(parseQuery('when>"2026-10-28T09:45:00Z"', [field]).test).length, 1);
});
