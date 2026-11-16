import { access, cp, mkdir, readFile } from 'node:fs/promises';

export async function exampleMetadata(name, destination) {
  const source = `demo-config/${name}`;
  const demo = await readFile(`${source}/demo.json`, 'utf8').catch(error => {
    if (error.code === 'ENOENT') { return null; }
    throw error;
  });
  if (!demo) { return {}; }
  JSON.parse(demo);
  JSON.parse(await readFile(`${source}/schema.metadata.json`, 'utf8'));
  const directory = `${destination}/demos/${name}`;
  await mkdir(directory, { recursive: true });
  for (const file of ['demo.json', 'schema.metadata.json']) { await cp(`${source}/${file}`, `${directory}/${file}`); }
  const metadata = { demo: `/demos/${name}/demo.json`, metadata: `/demos/${name}/schema.metadata.json` };
  // A curated example may also ship a precomputed map and clustering.
  if (await access(`${source}/results.json`).then(() => true, () => false)) {
    JSON.parse(await readFile(`${source}/results.json`, 'utf8'));
    await cp(`${source}/results.json`, `${directory}/results.json`);
    metadata.results = `/demos/${name}/results.json`;
  }
  return metadata;
}
