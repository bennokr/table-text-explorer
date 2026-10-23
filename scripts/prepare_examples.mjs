import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';

await rm('public/fixtures', { recursive: true, force: true });
await mkdir('public/fixtures', { recursive: true });
const names = await readdir('fixtures').catch(error => {
  if (error.code === 'ENOENT') { return []; }
  throw error;
});
const examples = [];
for (const name of names.sort()) {
  if (!/\.(csv|json|sav|xlsx)$/i.test(name)) { continue; }
  const information = await stat(`fixtures/${name}`);
  if (!information.isFile()) { continue; }
  await cp(`fixtures/${name}`, `public/fixtures/${name}`);
  examples.push({ name, bytes: information.size });
}
await writeFile('public/examples.json', JSON.stringify(examples));
console.log(`Prepared ${examples.length} local examples (excluded from Git).`);
