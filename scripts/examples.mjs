import { exampleMetadata } from './example-metadata.mjs';
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';

export async function prepareExamples(destination, privateExamples) {
  await rm(`${destination}/fixtures`, { recursive: true, force: true });
  await rm(`${destination}/demos`, { recursive: true, force: true });
  await mkdir(`${destination}/fixtures`, { recursive: true });
  const names = privateExamples ? await readdir('fixtures').catch(error => {
    if (error.code === 'ENOENT') { return []; }
    throw error;
  }) : [];
  const examples = [];
  const bundled = await readdir('examples');
  await cp('examples/attribution', `${destination}/attribution`, { recursive: true });
  for (const [directory, files] of [['examples', bundled], ['fixtures', names]]) {
    for (const name of files.sort()) {
      if (!/\.(csv|json|sav|xlsx)$/i.test(name)) { continue; }
      const information = await stat(`${directory}/${name}`);
      if (!information.isFile()) { continue; }
      if (examples.some(example => example.name === name)) { throw new Error(`Duplicate example: ${name}`); }
      await cp(`${directory}/${name}`, `${destination}/fixtures/${name}`);
      examples.push({ name, bytes: information.size, bundled: directory === 'examples',
        ...await exampleMetadata(name, destination) });
    }
  }
  await writeFile(`${destination}/examples.json`, JSON.stringify(examples));
  console.log(`Prepared ${examples.length} examples; ${privateExamples ? 'private examples enabled locally' : 'approved public examples only'}.`);
}
