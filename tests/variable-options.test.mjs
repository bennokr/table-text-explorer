import assert from 'node:assert/strict';
import test from 'node:test';
import { variableOptions, findVariables, variableGroups, selectionSummary } from '../src/variable-options.js';

const variables = variableOptions([
  { name: 'a', label: 'Café visits', kind: 'number', missing: 2, 'x-group': 'Activity' },
  { name: 'b', label: 'Free description', kind: 'text', missing: 9, 'x-group': 'Notes' },
  { name: 'c', label: 'Other visits', kind: 'number', missing: 0, 'x-group': 'Activity' },
], 10);

test('variable search combines names, descriptions and groups with independent type/selection filters', () => {
  const selected = new Set(['b']);
  assert.deepEqual(findVariables(variables, 'CAFE', '', false, selected).map(item => item.id), ['a']);
  assert.deepEqual(findVariables(variables, 'activity visits', 'number', false, selected).map(item => item.id), ['a', 'c']);
  assert.deepEqual(findVariables(variables, '', '', true, selected).map(item => item.id), ['b']);
  assert.deepEqual(findVariables(variables, 'visits', 'text', false, selected), []);
  assert.deepEqual([...selected], ['b']);
});

test('variable metadata and grouping preserve source order, coverage and compact selection summaries', () => {
  assert.equal(variables[0].nonMissing, 8);
  assert.deepEqual(variableGroups(variables).map(([group, items]) => [group, items.map(item => item.id)]),
    [['Activity', ['a', 'c']], ['Notes', ['b']]]);
  assert.equal(selectionSummary(variables, ['a'], false), 'a');
  assert.equal(selectionSummary(variables, ['a', 'b'], true), '2 variables');
  assert.equal(selectionSummary([], [], true), 'No variables');
});
