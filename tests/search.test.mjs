import assert from 'node:assert/strict';
import test from 'node:test';
import { Dataset } from '../src/state.js';
import { highlightQuery, bindSearch } from '../src/search.js';
import { valuePredicate, appendPredicate, phrasePredicate, formatQuery } from '../src/query-predicates.js';

test('query changes highlight visible matches, keep filters, and clear highlights for an empty query', () => {
  const model = new Dataset();
  model.load({ name: 'query', rows: [{ text: 'camera' }, { text: 'battery' }, { text: 'camera sharp' }] });
  model.pinned = new Set([0, 1]);
  model.refresh();
  highlightQuery(model, 'camera');
  assert.deepEqual([...model.selected], [0]);
  assert.deepEqual(model.visible, [0, 1]);
  assert.throws(() => highlightQuery(model, '(camera AND'));
  assert.deepEqual([...model.selected], [0]);
  highlightQuery(model, '');
  assert.equal(model.selected.size, 0);
  assert.deepEqual(model.visible, [0, 1]);
});

test('filter button flushes a pending query and applies its highlight only on explicit click', async () => {
  const model = new Dataset();
  model.load({ name: 'query', rows: [{ text: 'camera' }, { text: 'battery' }] });
  const nodes = new Map();
  const previous = globalThis.document;
  globalThis.document = { querySelector: selector => {
    if (!nodes.has(selector)) { nodes.set(selector, { removeAttribute() {}, setAttribute() {}, classList: { toggle() {} } }); }
    return nodes.get(selector);
  } };
  try {
    bindSearch(model);
    nodes.get('#search').value = 'camera';
    nodes.get('#search').oninput();
    assert.equal(model.visible.length, 2);
    await nodes.get('#filter-selection').onclick();
    assert.deepEqual([...model.selected], []);
    assert.deepEqual(model.visible, [0]);
    assert.equal(nodes.get('#search').value, '');
    assert.equal(model.ast, null);
    nodes.get('#clear-filters').onclick();
    assert.equal(model.visible.length, 2);
  } finally { globalThis.document = previous; }
});

test('description predicates serialize into editable queries without widening their matching', async () => {
  const { phrasePredicate, formatQuery } = await import('../src/query-predicates.js');
  const { parseQuery } = await import('../src/query.js');
  const field = 'Review "body"';
  const ast = { kind: 'and', left: phrasePredicate(field, 'café noir'),
    right: { kind: 'not', child: { kind: 'term', field: 'score', op: '<', value: '2' } } };
  const text = formatQuery(ast);
  const rows = [{ [field]: 'Café noir', score: 3 }, { [field]: 'cafénoir', score: 3 }];
  const seen = [];
  const parsed = parseQuery(text, [{ name: field }, { name: 'score', kind: 'number' }],
    { phrase: (column, phrase) => { seen.push([column.name, phrase]); return row => row === rows[0]; } });
  assert.deepEqual(parsed.ast, ast);
  assert.deepEqual(seen, [[field, 'café noir']]);
  assert.deepEqual(rows.filter(parsed.test), [rows[0]]);
});

async function queryFixture(run) {
  const model = new Dataset();
  model.load({ name: 'exact', rows: [{ text: 'camera sharp' }, { text: 'camera, sharp' }, { text: 'battery' }] });
  const nodes = new Map();
  const previous = globalThis.document;
  globalThis.document = { querySelector: selector => {
    if (!nodes.has(selector)) { nodes.set(selector, { value: '', focus() {}, removeAttribute() {}, setAttribute() {}, classList: { toggle() {} } }); }
    return nodes.get(selector);
  } };
  const workers = new EventTarget();
  const jobs = [];
  workers.run = (_, request) => new Promise(resolve => jobs.push({ request, resolve }));
  const analysis = { workers, generation: 0, progress() {}, busy: value => { model.analysisBusy = value; model.emit('busy'); } };
  try { await run({ model, nodes, search: bindSearch(model, analysis), jobs }); }
  finally { globalThis.document = previous; }
}

test('exact phrase queries respect visible records and stale requests cannot overwrite newer highlights', async () => {
  await queryFixture(async ({ model, nodes, search, jobs }) => {
    model.pinned = new Set([0, 1]);
    model.refresh();
    nodes.get('#search').value = 'text~"camera sharp"';
    const pending = search.apply();
    assert.deepEqual(jobs[0].request.requests, [{ field: 'text', phrase: 'camera sharp' }]);
    nodes.get('#search').value = 'battery';
    await search.apply();
    jobs[0].resolve({ matches: [{ field: 'text', phrase: 'camera sharp', ids: [0] }] });
    await pending;
    assert.deepEqual([...model.selected], []);
    nodes.get('#search').value = 'text~"camera sharp"';
    await search.apply();
    assert.deepEqual([...model.selected], [0]);
    assert.deepEqual(model.visible, [0, 1]);
    await search.filter();
    assert.deepEqual(model.visible, [0]);
  });
});


test('filter commits the brushed membership and clears the preview, including after a query', async () => {
  await queryFixture(async ({ model, nodes, search }) => {
    model.select([0, 2]);
    await search.filter();
    assert.deepEqual(model.visible, [0, 2]);
    assert.equal(model.selected.size, 0);
    search.clear();
    nodes.get('#search').value = 'camera';
    await search.apply();
    assert.deepEqual([...model.selected], [0, 1]);
    model.select([2]);
    assert.equal(nodes.get('#search').value, '');
    await search.filter();
    assert.deepEqual(model.visible, [2]);
    assert.equal(model.selected.size, 0);
    model.select([0, 2]);
    await search.filter();
    assert.deepEqual(model.visible, [2]);
  });
});

test('predicate clicks AND against current edits, preserve OR groups and avoid repeated conjuncts', async () => {
  await queryFixture(async ({ model, nodes }) => {
    nodes.get('#search').value = 'text="camera sharp" OR text:battery';
    model.querySuggestion = valuePredicate('text', 'camera sharp');
    model.emit('description-query');
    const input = nodes.get('#search').value;
    assert.equal(input, '(("text"="camera sharp" OR "text":"battery") AND "text"="camera sharp")');
    assert.deepEqual([...model.selected], [0]);
    assert.equal(model.ast.kind, 'and');
    model.emit('description-query');
    assert.equal(nodes.get('#search').value, input);
    assert.deepEqual(model.visible, [0, 1, 2]);
    nodes.get('#search').value = '(camera AND';
    model.emit('description-query');
    assert.equal(nodes.get('#search').value, '(camera AND');
    assert.deepEqual([...model.selected], [0]);
  });
});

test('phrase predicates stay exact when appended and duplicates are detected only in AND branches', () => {
  const phrase = phrasePredicate('text', 'camera sharp');
  const facet = valuePredicate('group', 'A');
  assert.strictEqual(appendPredicate(null, phrase), phrase);
  const query = appendPredicate(phrase, facet);
  assert.equal(formatQuery(query), '("text"~"camera sharp" AND "group"="A")');
  assert.strictEqual(appendPredicate(query, phrase), query);
  const alternatives = { kind: 'or', left: phrase, right: facet };
  assert.equal(appendPredicate(alternatives, phrase).kind, 'and');
});

test('clear selection cancels pending phrase highlights without removing committed filters', async () => {
  await queryFixture(async ({ model, nodes, search, jobs }) => {
    model.pinned = new Set([0, 1]);
    model.refresh();
    nodes.get('#search').value = 'text~"camera sharp"';
    const pending = search.apply();
    await search.filter();
    nodes.get('#clear-selection').onclick();
    jobs[0].resolve({ matches: [{ field: 'text', phrase: 'camera sharp', ids: [0] }] });
    await pending;
    assert.equal(nodes.get('#search').value, '');
    assert.equal(model.ast, null);
    assert.equal(model.selected.size, 0);
    assert.deepEqual(model.visible, [0, 1]);
    model.select([0]);
    nodes.get('#search').value = '(invalid';
    nodes.get('#search').oninput();
    nodes.get('#clear-selection').onclick();
    assert.equal(search.timer, null);
    assert.equal(model.selected.size, 0);
    assert.deepEqual(model.visible, [0, 1]);
  });
});

test('record navigation keeps the query; a changed brush invalidates a pending query result', async () => {
  await queryFixture(async ({ model, nodes, search, jobs }) => {
    nodes.get('#search').value = 'camera';
    await search.apply();
    model.select([1, 0], 1);
    assert.equal(nodes.get('#search').value, 'camera');
    nodes.get('#search').value = 'text~"camera sharp"';
    const pending = search.apply();
    model.select([2]);
    jobs[0].resolve({ matches: [{ field: 'text', phrase: 'camera sharp', ids: [0] }] });
    await pending;
    assert.deepEqual([...model.selected], [2]);
    assert.equal(nodes.get('#search').value, '');
    assert.equal(model.ast, null);
  });
});
