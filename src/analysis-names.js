import { featureFields, isEmbeddingMode } from './features.js';
import { descriptionEnabled } from './group-vectors.js';

function token(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 28);
}

export function uniqueAnalysisName(model, suggested) {
  const used = new Set(model.results.list().map(result => result.mapName ?? result.name));
  let name = suggested, suffix = 2;
  while (used.has(name)) { name = `${suggested}-${suffix++}`; }
  return name;
}

const modelTokens = { dutch: 'nl-l6' };

function chunkName(config) {
  const standard = config.sentenceChunkSize === 126 && config.sentenceOverlap === 0;
  if (config.sentenceChunking !== 'chunks') { return `first${config.sentenceChunkSize}`; }
  // Default chunking is left out: a name should say what differs from the defaults.
  return standard ? '' : `chunks${config.sentenceChunkSize}o${config.sentenceOverlap}`;
}

function sentenceName(config) {
  const model = String(config.sentenceModel).startsWith('import:') ? 'imported' : modelTokens[config.sentenceModel] ?? '';
  const context = descriptionEnabled(config) ? 'descriptions' : '';
  const groups = config.combine === 'group-mean' ? `groups${Math.round(100 * config.groupIdentity)}` : '';
  return [model, chunkName(config), context, groups].filter(Boolean);
}

export function mapName(model, config, method) {
  const fields = featureFields({ fields: model.fields, config }).slice(0, 2).map(field => token(field.name));
  const parts = [...fields, config.mode];
  if (config.mode === 'words') { parts.push(config.vectorLanguage); }
  if (config.mode === 'words' && config.pooling !== 'mean') { parts.push(config.pooling); }
  if (config.mode === 'sentences') { parts.push(...sentenceName(config)); }
  if (config.combine === 'concat' && isEmbeddingMode(config.mode)) { parts.push('concat'); }
  return uniqueAnalysisName(model, [...parts, method].filter(Boolean).join('-'));
}

export function clusteringName(model, sourceId, parameters) {
  const source = model.results.get(sourceId);
  const base = source?.mapName ?? source?.name ?? mapName(model, model.config, 'features');
  const detail = parameters.method === 'hdbscan' ? `min${parameters.minClusterSize}` : `k${parameters.clusters}`;
  return uniqueAnalysisName(model, `${base.slice(0, 64)}-${parameters.method}-${detail}`);
}

export function suggestName(input, suggestion) {
  if (!input.value.trim() || input.value === input.dataset.suggested) { input.value = suggestion; }
  input.dataset.suggested = suggestion;
}
