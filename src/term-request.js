import { $, options } from './dom.js';
import { comparisonSets } from './term-view.js';
import { clusterComparison } from './cluster-descriptions.js';
import { setTermSettings, termScope, treeChoice } from './term-settings-model.js';

function embeddingChoices(model) {
  return model.results.list('representation').filter(result => result.embeddings && result.embeddingDimensions);
}

export function refreshEmbeddingChoices(model) {
  const select = $('#terms-embedding');
  const settings = model.termSettings;
  const choices = embeddingChoices(model);
  options(select, choices.map(result => [result.id, result.name]), settings.embedding);
  $('#terms-ranking option[value="semantic"]').disabled = !choices.length;
  if (!choices.length && settings.ranking === 'semantic') { setTermSettings(model, { ranking: 'auto' }); }
  if (choices.length && !choices.some(result => result.id === settings.embedding)) { setTermSettings(model, { embedding: choices[0].id }); }
  select.hidden = settings.ranking !== 'semantic';
}

function compareQuery(compare, indexId, settings) {
  const groups = compare.groups.map(({ id, name, subset, comparison }) => ({ id, name, subset, comparison }));
  return { indexId, subset: compare.population, comparison: [], groups, support: settings.support, ranking: 'contrast',
    content: settings.content, deduplicate: settings.deduplicate };
}

// What to describe when no column colours the cloud: the highlight, a population, or a tree's branches.
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
  const result = model.results.get(payload.embeddingId);
  if (!result?.embeddings) { throw new Error('Choose an existing embedding result for semantic splits.'); }
  return { ...payload, features: result.embeddings, embeddingDimensions: result.embeddingDimensions,
    embeddingRowIds: result.rowIds };
}
