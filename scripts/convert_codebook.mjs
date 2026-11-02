import { readFile, writeFile } from 'node:fs/promises';
import { readCodebook } from '../src/codebook-profile.js';

const [source, destination] = process.argv.slice(2).filter(argument => !argument.startsWith('--'));
if (!source || !destination) { throw new Error('Usage: node scripts/convert_codebook.mjs input.xlsx output.metadata.json [--strict]'); }
const schema = readCodebook(await readFile(source), { strict: process.argv.includes('--strict') });
await writeFile(destination, JSON.stringify(schema, null, 2) + '\n');
console.log(`Converted ${schema.fields.length} variable definitions.`);
