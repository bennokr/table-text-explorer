import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { colorColumn, setTermSettings, termScope, treeChoice } from '../src/term-settings-model.js';

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

test('Contrast names the records to describe and Color names a column or a tree; a new table goes back to Auto and Previous step but keeps the rest', () => {
  const model = new Dataset();
  setTermSettings(model, { contrast: 'current', color: 'col:party', support: 7 });
  assert.equal(termScope(model.termSettings), 'visible');
  assert.deepEqual(['previous', 'rest', 'all'].map(contrast => termScope({ contrast })), ['selection', 'filtered', 'all']);
  assert.equal(termScope({ contrast: 'nonsense' }), 'selection');
  assert.equal(colorColumn(model.termSettings), 'party');
  assert.equal(colorColumn({ color: 'tree:result-2' }), null);
  assert.equal(treeChoice({ color: 'tree:result-2' }), 'result-2');
  assert.equal(treeChoice({ color: 'auto' }), null);
  model.load({ name: 'next', rows: [{ a: 1 }] });
  assert.equal(model.termSettings.color, 'auto');
  assert.equal(model.termSettings.contrast, 'previous', 'Contrast goes back too: it names records of the old table');
  assert.equal(model.termSettings.support, 7);
});
