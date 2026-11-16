import { comparisonSets } from './term-view.js';
import { clusterComparison } from './cluster-descriptions.js';
import { termScope, treeChoice } from './term-settings-model.js';
import { embeddingsFor } from './size-choices.js';

function compareQuery(compare, indexId, settings) {
  const groups = compare.groups.map(({ id, name, subset, comparison }) => ({ id, name, subset, comparison }));
  return { indexId, subset: compare.population, comparison: [], groups, support: settings.support, ranking: 'contrast',
    content: settings.content, deduplicate: settings.deduplicate };
}

// What to describe when no column splits the cloud into values: the highlight against its contrast, or a tree's branches.
function scopeQuery(model, indexId) {
  const settings = model.termSettings;
  const tree = treeChoice(settings);
  const population = (tree && clusterComparison(model, tree, settings.groupPage, settings.treeComparison))
    || comparisonSets(model, termScope(settings));
  const ranking = settings.ranking === 'auto' ? (population.groups || population.comparison.length ? 'contrast' : 'frequency') : settings.ranking;
  return { indexId, ...population, support: settings.support, ranking, content: settings.content, deduplicate: settings.deduplicate,
    ...(ranking === 'semantic' ? { embeddingId: settings.embedding } : {}) };
}

export function descriptionQuery(model, indexId, compare = null) {
  const settings = model.termSettings;
  if (!Number.isInteger(settings.support) || settings.support < 1) { throw new Error('Minimum support must be a positive record count.'); }
  return compare ? compareQuery(compare, indexId, settings) : scopeQuery(model, indexId);
}

export function withEmbeddings(model, payload) {
  if (payload.ranking !== 'semantic') { return payload; }
  const embeddings = embeddingsFor(model, payload.embeddingId);
  if (!embeddings) { throw new Error('Choose existing embeddings for semantic splits.'); }
  return { ...payload, ...embeddings };
}
