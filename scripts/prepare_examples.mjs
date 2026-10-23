import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';

await rm('public/fixtures', { recursive: true, force: true });
await mkdir('public/fixtures', { recursive: true });
const names = await readdir('fixtures').catch(error => {
  if (error.code === 'ENOENT') { return []; }
  throw error;
});
const examples = [];
const bundled = await readdir('examples');
await cp('examples/attribution', 'public/attribution', { recursive: true });
for (const [directory, files] of [['examples', bundled], ['fixtures', names]]) {
  for (const name of files.sort()) {
    if (!/\.(csv|json|sav|xlsx)$/i.test(name)) { continue; }
    const information = await stat(`${directory}/${name}`);
    if (!information.isFile()) { continue; }
    if (examples.some(example => example.name === name)) { throw new Error(`Duplicate example: ${name}`); }
    await cp(`${directory}/${name}`, `public/fixtures/${name}`);
    examples.push({ name, bytes: information.size, bundled: directory === 'examples' });
  }
}
await writeFile('public/examples.json', JSON.stringify(examples));
console.log(`Prepared ${examples.length} examples; private fixtures remain excluded from Git.`);
