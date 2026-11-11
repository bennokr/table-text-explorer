import { $, options } from './dom.js';
import { comparisonSets } from './term-view.js';
import { clusterComparison } from './cluster-descriptions.js';

function embeddingChoices(model) {
  return model.results.list('representation').filter(result => result.embeddings && result.embeddingDimensions);
}

export function refreshEmbeddingChoices(model) {
  const select = $('#terms-embedding');
  const choices = embeddingChoices(model);
  options(select, choices.map(result => [result.id, result.name]), select.value);
  $('#terms-ranking option[value="semantic"]').disabled = !choices.length;
  if (!choices.length && $('#terms-ranking').value === 'semantic') { $('#terms-ranking').value = 'auto'; }
  select.hidden = $('#terms-ranking').value !== 'semantic';
}

function compareQuery(compare, indexId, support) {
  const groups = compare.groups.map(({ id, name, subset, comparison }) => ({ id, name, subset, comparison }));
  return { indexId, subset: compare.population, comparison: [], groups, support, ranking: 'contrast',
    content: $('#terms-content').value, deduplicate: $('#terms-deduplicate').checked };
}

function scopeQuery(model, indexId, support) {
  const population = clusterComparison(model, $('#terms-scope').value, Number($('#terms-group-page').value), $('#terms-tree-comparison').value)
    ?? comparisonSets(model, $('#terms-scope').value);
  const chosen = $('#terms-ranking').value;
  const ranking = chosen === 'auto' ? (population.groups || population.comparison.length ? 'contrast' : 'frequency') : chosen;
  return { indexId, ...population, support, ranking, content: $('#terms-content').value, deduplicate: $('#terms-deduplicate').checked,
    ...(ranking === 'semantic' ? { embeddingId: $('#terms-embedding').value } : {}) };
}

export function descriptionQuery(model, indexId, compare = null) {
  const support = Number($('#terms-support').value);
  if (!Number.isInteger(support) || support < 1) { throw new Error('Minimum support must be a positive record count.'); }
  return compare ? compareQuery(compare, indexId, support) : scopeQuery(model, indexId, support);
}

export function withEmbeddings(model, payload) {
  if (payload.ranking !== 'semantic') { return payload; }
  const result = model.results.get(payload.embeddingId);
  if (!result?.embeddings) { throw new Error('Choose an existing embedding result for semantic splits.'); }
  return { ...payload, features: result.embeddings, embeddingDimensions: result.embeddingDimensions,
    embeddingRowIds: result.rowIds };
}
