import { withBase } from './base.js';
import { readEmbeddings } from './embedding-files.js';

// An example's demo.json can list embeddings that ship with it ({ file, field, model, default }). They are fetched
// from the bundled fixtures and read like an imported file; one that is not there (a build without the data
// release) or does not fit the table is skipped, and the example works without it.
export async function fetchExampleEmbeddings(list = [], rows, progress) {
  const loaded = [];
  for (const item of list) {
    try {
      const response = await fetch(withBase(`fixtures/${item.file}`));
      if (!response.ok) { continue; }
      progress({ message: `Reading embeddings · ${item.field}` });
      loaded.push({ ...item, ...readEmbeddings(await response.arrayBuffer(), item.file, rows) });
    } catch { /* A missing or mismatched file leaves the example as it was. */ }
  }
  return loaded;
}

// Makes the vectors available to the map form as imported embeddings, and returns which one the example prefers.
export function registerExampleEmbeddings(model, loaded = []) {
  const keys = loaded.map(item => {
    model.embeddingSequence += 1;
    const key = `import:${model.embeddingSequence}`;
    model.importedEmbeddings.set(key, { name: `${item.field} (${item.model})`, features: item.features,
      dimensions: item.dimensions, rowIds: item.rowIds });
    return { key, field: item.field, preferred: Boolean(item.default) };
  });
  return keys.find(item => item.preferred) ?? keys[0] ?? null;
}
