// Restores the MiniLM models from the pinned GitHub release instead of downloading from Hugging Face
// and exporting the Dutch model with torch. Returns manifest entries, or null when the release
// cannot be used (not published yet, no access, hash mismatch); callers then fall back.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const cache = '.cache/model-release';
const destination = 'public/vendor/models';
const digest = data => createHash('sha256').update(data).digest('hex');

async function cached(asset) {
  const data = await readFile(`${cache}/${asset.name}`).catch(() => null);
  return data && digest(data) === asset.sha256 ? data : null;
}

// `gh` handles private repositories (CI passes GH_TOKEN); a public release also works with curl.
function download(release, asset) {
  const url = `https://github.com/${release.repository}/releases/download/${release.tag}/${asset.name}`;
  const gh = ['release', 'download', release.tag, '--repo', release.repository, '--pattern', asset.name,
    '--dir', cache, '--clobber'];
  try { execFileSync('gh', gh, { stdio: 'ignore' }); }
  catch { execFileSync('curl', ['-fsSL', url, '-o', `${cache}/${asset.name}`], { stdio: 'ignore' }); }
}

async function fetchAsset(release, asset) {
  const existing = await cached(asset);
  if (existing) { return existing; }
  download(release, asset);
  const data = await cached(asset);
  if (!data) { throw new Error(`Hash mismatch for ${asset.name}`); }
  return data;
}

export async function restoreModelRelease() {
  const release = JSON.parse(await readFile('scripts/model-release.json', 'utf8'));
  await mkdir(cache, { recursive: true });
  await mkdir(destination, { recursive: true });
  const entries = [];
  try {
    for (const asset of release.assets) {
      const data = await fetchAsset(release, asset);
      execFileSync('tar', ['-xzf', `${cache}/${asset.name}`, '-C', destination]);
      entries.push({ url: `release:${release.tag}/${asset.name}`, path: `${destination}/${asset.model}`, bytes: data.length, sha256: asset.sha256 });
    }
  } catch (error) {
    // In CI a silent fallback would ship a site without models (or try a torch export), so fail loudly there.
    if (process.env.MODEL_RELEASE_REQUIRED) { throw new Error(`Model release unavailable: ${error.message}`, { cause: error }); }
    console.log(`Model release unavailable (${error.message}); falling back to Hugging Face.`);
    return null;
  }
  return entries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const entries = await restoreModelRelease();
  await writeFile(`${cache}/restored.json`, JSON.stringify(entries, null, 2));
  console.log(entries ? entries.map(entry => entry.path).join('\n') : 'not restored');
}
