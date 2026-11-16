import { $ } from './dom.js';
import { setTermSettings } from './term-settings-model.js';

// The Size select holds how phrases are scored. Semantic splits need embeddings, so each embedding the table has is
// its own entry (an imported file, or a saved representation): "semantic:<key>" in the select, `ranking` plus
// `embedding` in the settings.
export function embeddingChoices(model) {
  const imported = [...model.importedEmbeddings].map(([key, item]) => ({ key, label: `Imported · ${item.name}` }));
  const saved = model.results.list('representation').filter(result => result.embeddings && result.embeddingDimensions)
    .map(result => ({ key: result.id, label: result.name }));
  return [...imported, ...saved];
}

export const sizeValue = ({ ranking, embedding }) => (ranking === 'semantic' ? `semantic:${embedding}` : ranking);

export function sizeSettings(value) {
  const [ranking, ...key] = value.split(':');
  return ranking === 'semantic' ? { ranking, embedding: key.join(':') } : { ranking };
}

function showSplitEntries(choices) {
  const group = $('#size-splits');
  for (const option of group.querySelectorAll('option[value^="semantic"]')) { option.remove(); }
  if (!choices.length) {
    const none = new Option('Semantic splits · needs embeddings', 'semantic');
    none.disabled = true;
    group.append(none);
    return;
  }
  group.append(...choices.map(choice => new Option(`Semantic splits · ${choice.label}`, `semantic:${choice.key}`)));
}

// Keeps the settings and the select in step with the embeddings that exist.
export function refreshSizeChoices(model) {
  const settings = model.termSettings;
  const choices = embeddingChoices(model);
  showSplitEntries(choices);
  if (!choices.length && settings.ranking === 'semantic') { setTermSettings(model, { ranking: 'auto' }); }
  if (choices.length && !choices.some(choice => choice.key === settings.embedding)) { setTermSettings(model, { embedding: choices[0].key }); }
  $('#terms-ranking').value = sizeValue(model.termSettings);
}

// The embeddings behind a semantic request: an imported file or a saved representation.
export function embeddingsFor(model, key) {
  const imported = model.importedEmbeddings.get(key);
  if (imported) { return { features: imported.features, embeddingDimensions: imported.dimensions, embeddingRowIds: imported.rowIds }; }
  const saved = model.results.get(key);
  if (!saved?.embeddings) { return null; }
  return { features: saved.embeddings, embeddingDimensions: saved.embeddingDimensions, embeddingRowIds: saved.rowIds };
}
