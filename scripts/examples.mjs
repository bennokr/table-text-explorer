import { exampleMetadata } from './example-metadata.mjs';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';

const TABLE = /\.(csv|json|sav|xlsx)$/i;

async function listing(directory) {
  return readdir(directory).catch(error => {
    if (error.code === 'ENOENT') { return []; }
    throw error;
  });
}

async function bundleTable(directory, name, destination) {
  await cp(`${directory}/${name}`, `${destination}/fixtures/${name}`);
  const information = await stat(`${directory}/${name}`);
  return { name, bytes: information.size, bundled: directory !== 'fixtures', ...await exampleMetadata(name, destination) };
}

// Tables from a directory, skipping other files and names that a released dataset replaces.
async function tablesIn(directory, replaced) {
  const names = (await listing(directory)).sort().filter(name => TABLE.test(name) && !replaced.has(name));
  const tables = [];
  for (const name of names) { if ((await stat(`${directory}/${name}`)).isFile()) { tables.push(name); } }
  return tables;
}

// A released dataset brings its table and its embeddings; a tracked example (DBRD) brings only embeddings.
async function bundleReleased(dataset, destination) {
  for (const asset of dataset.assets) { await cp(`${dataset.directory}/${asset.name}`, `${destination}/fixtures/${asset.name}`); }
  if (!dataset.assets.some(asset => asset.name === dataset.name)) { return null; }
  const example = await bundleTable(dataset.directory, dataset.name, destination);
  return { ...example, bundled: true, released: true };
}

async function collect(privateExamples, replaced, destination) {
  const examples = [];
  for (const [directory, enabled] of [['examples', true], ['fixtures', privateExamples]]) {
    // A released table replaces a private fixture of the same name, never a tracked example.
    for (const name of enabled ? await tablesIn(directory, directory === 'fixtures' ? replaced : new Set()) : []) {
      if (examples.some(example => example.name === name)) { throw new Error(`Duplicate example: ${name}`); }
      examples.push(await bundleTable(directory, name, destination));
    }
  }
  return examples;
}

// `released` are datasets restored from the data release, bundled like the tracked examples.
export async function prepareExamples(destination, privateExamples, released = []) {
  await rm(`${destination}/fixtures`, { recursive: true, force: true });
  await rm(`${destination}/demos`, { recursive: true, force: true });
  await mkdir(`${destination}/fixtures`, { recursive: true });
  await cp('examples/attribution', `${destination}/attribution`, { recursive: true });
  const examples = await collect(privateExamples, new Set(released.filter(dataset => dataset.assets.some(asset => asset.name === dataset.name)).map(dataset => dataset.name)), destination);
  const extra = await Promise.all(released.map(dataset => bundleReleased(dataset, destination)));
  examples.push(...extra.filter(Boolean));
  examples.sort((a, b) => a.name.localeCompare(b.name));
  await writeFile(`${destination}/examples.json`, JSON.stringify(examples));
  console.log(`Prepared ${examples.length} examples; ${privateExamples ? 'private examples enabled locally' : 'approved public examples only'}.`);
}
