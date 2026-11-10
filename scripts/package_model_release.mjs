// Packages the two prepared MiniLM models as GitHub release assets and pins their hashes in
// scripts/model-release.json. Run after `npm run prepare:sentences`, then upload the archives:
//   gh release create models-v1 .cache/model-release/*.tar.gz .cache/model-release/SHA256SUMS
// Later machines and CI restore them with scripts/restore_model_release.mjs and never run the
// torch export. Archives are deterministic, so packaging the same files gives the same hashes.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { sentenceModels } from '../src/sentence-models.js';

const root = 'public/vendor/models';
const output = '.cache/model-release';
const release = { repository: 'bennokr/table-text-explorer', tag: 'models-v1' };
const archiveNames = { multilingual: 'minilm-multilingual-l12-q8.tar.gz', dutch: 'minilm-dutch-l6-q8.tar.gz' };
const digest = data => createHash('sha256').update(data).digest('hex');

function archive(model) {
  const tar = ['--sort=name', '--mtime=@0', '--owner=0', '--group=0', '--numeric-owner', '-C', root, '-cf', '-', model.id];
  const packed = execFileSync('tar', tar, { maxBuffer: 1024 * 1024 * 1024 });
  return execFileSync('gzip', ['-n', '-9'], { input: packed, maxBuffer: 1024 * 1024 * 1024 });
}

async function packageModel(key, model) {
  const bytes = archive(model);
  const name = archiveNames[key];
  await writeFile(`${output}/${name}`, bytes);
  return { key, model: model.id, revision: model.revision, name, bytes: bytes.length, sha256: digest(bytes) };
}

await mkdir(output, { recursive: true });
const assets = [];
for (const [key, model] of Object.entries(sentenceModels)) { assets.push(await packageModel(key, model)); }
await writeFile('scripts/model-release.json', `${JSON.stringify({ ...release, assets }, null, 2)}\n`);
await writeFile(`${output}/SHA256SUMS`, assets.map(asset => `${asset.sha256}  ${asset.name}\n`).join(''));
console.log(assets.map(asset => `${asset.name}: ${(asset.bytes / 1e6).toFixed(1)} MB ${asset.sha256}`).join('\n'));
console.log(`Verify: ${(await readFile('scripts/model-release.json', 'utf8')).length} bytes of manifest written.`);
