import { readdir, readFile } from 'node:fs/promises';
import { parse } from 'espree';
import { KEYS } from 'eslint-visitor-keys';

const excluded = new Set(['node_modules', 'dist', 'dist-feasibility', 'vendor', '.cache', '.venv', '.git']);

async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) { continue; }
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) { found.push(...await files(path)); }
    else if (/\.(mjs|js)$/.test(path)) { found.push(path); }
  }
  return found;
}

function statements(node) {
  let count = /Statement$|Declaration$/.test(node.type) ? 1 : 0;
  for (const key of KEYS[node.type] ?? []) {
    const children = Array.isArray(node[key]) ? node[key] : [node[key]];
    for (const child of children) {
      if (child) { count += statements(child); }
    }
  }
  return count;
}

let total = 0;
for (const path of await files('.')) {
  const tree = parse(await readFile(path, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  const count = statements(tree);
  console.log(`${path}: ${count} JavaScript statements`);
  if (count > 250) { throw new Error(`${path}: module exceeds 250 statements`); }
  total += count;
}
if (total > 12650) { throw new Error('JavaScript exceeds 12650 statements'); }
