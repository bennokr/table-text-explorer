import { readFile, writeFile } from 'node:fs/promises';
import { readCodebook } from '../src/codebook-profile.js';

const [source, destination] = process.argv.slice(2);
if (!source || !destination) { throw new Error('Usage: node scripts/convert_codebook.mjs input.xlsx output.metadata.json'); }
const schema = readCodebook(await readFile(source));
await writeFile(destination, JSON.stringify(schema, null, 2) + '\n');
console.log(`Converted ${schema.fields.length} variable definitions.`);
