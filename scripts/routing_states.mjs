import { readFile, writeFile } from 'node:fs/promises';
import { schemaMetadata } from '../src/field-metadata.js';
import { routingStates } from '../src/routing.js';
import { inferSchema } from '../src/schema.js';
import { parseTable } from '../src/table-readers.js';

const usage = 'Usage: node scripts/routing_states.mjs table.(csv|json|xlsx|sav) schema.metadata.json states.json';
const [tablePath, schemaPath, outputPath] = process.argv.slice(2);
if (!tablePath || !schemaPath || !outputPath) { throw new Error(usage); }
const table = parseTable(await readFile(tablePath), tablePath);
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const fields = inferSchema(table.rows, schemaMetadata(schema, table.metadata));
const { states, errors } = routingStates(table.rows, fields);
await writeFile(outputPath, JSON.stringify({ states: Object.fromEntries(states), errors }));
console.log(`${fields.length} columns, ${fields.filter(field => field.appliesWhen).length} with applies_when, ${errors.length} rule errors`);
