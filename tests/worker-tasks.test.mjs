import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

test('every task the page asks the Python worker for is in worker_entry.py, and the modules share no globals', async () => {
  const entry = await readFile(new URL('../src/workers/worker_entry.py', import.meta.url), 'utf8');
  const known = new Set([...entry.matchAll(/^\s+"([a-z_]+)": [a-z_]+,$/gmu)].map(match => match[1]));
  const sources = await readdir(new URL('../src/', import.meta.url));
  const requested = new Set();
  for (const name of sources.filter(file => file.endsWith('.js'))) {
    const text = await readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');
    for (const match of text.matchAll(/task: '([a-z_]+)'/gu)) { requested.add(match[1]); }
  }
  requested.delete('initialize');
  assert.deepEqual([...requested].filter(task => !known.has(task)), [], 'a task with no Python function');
  for (const name of (await readdir(new URL('../src/workers/', import.meta.url))).filter(file => file.endsWith('.py'))) {
    const text = await readFile(new URL(`../src/workers/${name}`, import.meta.url), 'utf8');
    assert.equal(/globals\(\)/u.test(text), false, `${name} reaches into another module's globals`);
  }
});
