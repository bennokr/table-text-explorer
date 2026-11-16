// Downloads release assets pinned by hash. Shared by the model and example-data restores.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';

const digest = data => createHash('sha256').update(data).digest('hex');

async function cached(cache, asset) {
  const data = await readFile(`${cache}/${asset.name}`).catch(() => null);
  return data && digest(data) === asset.sha256 ? data : null;
}

// `gh` handles private repositories (CI passes GH_TOKEN); a public release also works with curl.
function download(release, asset, cache) {
  const url = `https://github.com/${release.repository}/releases/download/${release.tag}/${asset.name}`;
  const gh = ['release', 'download', release.tag, '--repo', release.repository, '--pattern', asset.name, '--dir', cache, '--clobber'];
  try { execFileSync('gh', gh, { stdio: 'ignore' }); }
  catch { execFileSync('curl', ['-fsSL', url, '-o', `${cache}/${asset.name}`], { stdio: 'ignore' }); }
}

// The asset's bytes, from the cache when its hash matches, else downloaded and checked.
export async function fetchReleaseAsset(release, asset, cache) {
  await mkdir(cache, { recursive: true });
  const existing = await cached(cache, asset);
  if (existing) { return existing; }
  download(release, asset, cache);
  const data = await cached(cache, asset);
  if (!data) { throw new Error(`Hash mismatch for ${asset.name}`); }
  return data;
}
