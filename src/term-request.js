import { $, options } from './dom.js';
import { comparisonSets } from './term-view.js';
import { clusterComparison } from './cluster-descriptions.js';

export function embeddingChoices(model) {
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

export function descriptionQuery(model, indexId) {
  const support = Number($('#terms-support').value);
  if (!Number.isInteger(support) || support < 1) { throw new Error('Minimum support must be a positive record count.'); }
  const population = clusterComparison(model, $('#terms-scope').value, Number($('#terms-group-page').value), $('#terms-tree-comparison').value)
    ?? comparisonSets(model, $('#terms-scope').value);
  const chosen = $('#terms-ranking').value;
  const ranking = chosen === 'auto' ? (population.groups || population.comparison.length ? 'contrast' : 'frequency') : chosen;
  return { indexId, ...population, support, ranking, content: $('#terms-content').value, deduplicate: $('#terms-deduplicate').checked,
    ...(ranking === 'semantic' ? { embeddingId: $('#terms-embedding').value } : {}) };
}

export function withEmbeddings(model, payload) {
  if (payload.ranking !== 'semantic') { return payload; }
  const result = model.results.get(payload.embeddingId);
  if (!result?.embeddings) { throw new Error('Choose an existing embedding result for semantic splits.'); }
  return { ...payload, features: result.embeddings, embeddingDimensions: result.embeddingDimensions,
    embeddingRowIds: result.rowIds };
}
