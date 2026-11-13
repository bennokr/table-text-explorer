import { readdirSync, readFileSync } from 'node:fs';
import { groupFiles } from '../src/lexicon-parse.js';

// The real lexicon files, read from disk the way the bundler reads them.
export function loadLexicon() {
  const root = new URL('../src/lexicon/', import.meta.url);
  const files = {};
  for (const code of readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)) {
    for (const name of readdirSync(new URL(`${code}/`, root))) {
      files[`./lexicon/${code}/${name}`] = readFileSync(new URL(`${code}/${name}`, root), 'utf8');
    }
  }
  return groupFiles(files);
}
