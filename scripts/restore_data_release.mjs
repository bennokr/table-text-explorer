// Restores the example datasets and their precomputed embeddings from the pinned `data-v1` release.
// Returns the datasets with their restored files, or [] when the release cannot be used and is not required.
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fetchReleaseAsset } from './release_assets.mjs';

const cache = '.cache/data-release';
const restored = `${cache}/files`;

export async function restoreDataRelease() {
  const release = JSON.parse(await readFile('scripts/data-release.json', 'utf8'));
  if (!release.datasets.length) { return []; }
  await mkdir(restored, { recursive: true });
  try {
    for (const dataset of release.datasets) {
      for (const asset of dataset.assets) {
        await fetchReleaseAsset(release, asset, `${cache}/downloads`);
        await copyFile(`${cache}/downloads/${asset.name}`, `${restored}/${asset.name}`);
      }
    }
  } catch (error) {
    // In CI a silent fallback would ship a site without its examples.
    if (process.env.DATA_RELEASE_REQUIRED) { throw new Error(`Data release unavailable: ${error.message}`, { cause: error }); }
    console.log(`Data release unavailable (${error.message}); the examples come from this checkout only.`);
    return [];
  }
  return release.datasets.map(dataset => ({ ...dataset, directory: restored }));
}
