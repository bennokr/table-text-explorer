// Restores the MiniLM models from the pinned GitHub release instead of downloading from Hugging Face
// and exporting the Dutch model with torch. Returns manifest entries, or null when the release
// cannot be used (not published yet, no access, hash mismatch); callers then fall back.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchReleaseAsset } from './release_assets.mjs';

const cache = '.cache/model-release';
const destination = 'public/vendor/models';

export async function restoreModelRelease() {
  const release = JSON.parse(await readFile('scripts/model-release.json', 'utf8'));
  await mkdir(destination, { recursive: true });
  const entries = [];
  try {
    for (const asset of release.assets) {
      const data = await fetchReleaseAsset(release, asset, cache);
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
