import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { setTermSettings, termScope, treeChoice } from '../src/term-settings-model.js';

test('term settings are plain data on the model, announced once when they really change', () => {
  const model = new Dataset();
  let announced = 0;
  model.on('term-settings', () => { announced += 1; });
  assert.equal(setTermSettings(model, { ranking: 'semantic', support: 5 }), true);
  assert.equal(announced, 1);
  assert.equal(setTermSettings(model, { ranking: 'semantic' }), false, 'unchanged: nothing is announced');
  assert.equal(announced, 1);
  assert.deepEqual([model.termSettings.ranking, model.termSettings.support], ['semantic', 5]);
});

test('the comparison choice names a scope or a tree, and a new table goes back to Auto but keeps the rest', () => {
  const model = new Dataset();
  setTermSettings(model, { compare: 'population:visible', support: 7 });
  assert.equal(termScope(model.termSettings), 'visible');
  assert.equal(termScope({ compare: 'col:party' }), 'selection');
  assert.equal(termScope({ compare: 'population:nonsense' }), 'selection');
  assert.equal(treeChoice({ compare: 'tree:result-2' }), 'result-2');
  assert.equal(treeChoice({ compare: 'auto' }), null);
  model.load({ name: 'next', rows: [{ a: 1 }] });
  assert.equal(model.termSettings.compare, 'auto');
  assert.equal(model.termSettings.support, 7);
});
