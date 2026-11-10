import { temporal } from './dates.js';
import { missing, numberOf } from './schema.js';
import { fieldDescription } from './field-metadata.js';
import { descriptionEnabled, groupName } from './group-vectors.js';
import { defaultSentenceModel } from './sentence-models.js';

export const isEmbeddingMode = mode => ['words', 'sentences'].includes(mode);

export function featureCandidates(model) {
  return model.fields.filter(field => !field.derived).filter(field => model.config.mode !== 'table'
    ? field.storage === 'string' && !field.identifier
    : field.kind !== 'empty' && field.kind !== 'text' && !field.identifier);
}

export function featureFields(model) {
  const candidates = featureCandidates(model);
  if (Array.isArray(model.config.features)) {
    return candidates.filter(field => model.config.features.includes(field.name));
  }
  const automatic = candidates.filter(field => !field.annotation);
  if (model.config.mode === 'table') { return automatic; }
  const text = automatic.filter(field => field.kind === 'text');
  return (text.length ? text : automatic).slice(0, 1);
}

const stopwords = {
  nl: 'de het een en van in op te dat die is was voor met aan er om als ik je hij zij wij niet maar ook dan dit zijn wordt door bij naar tot uit heeft hebben',
  en: 'the a an and of in on to that is was for with at as I you he she we not but also then this are be by from has have',
  none: '',
};

export function stopwordList(config, keepNegation = false) {
  const negations = new Set(['niet', 'geen', 'nooit', 'not', 'no', 'never']);
  const base = config.language.split(',').flatMap(language => (stopwords[language] ?? '').toLowerCase().split(/\s+/u))
    .filter(word => !keepNegation || !negations.has(word));
  const extra = config.stopwords.toLowerCase().split(/[\s,]+/u);
  return [...new Set([...base, ...extra].filter(Boolean))];
}

function featureDescriptor(field, config) {
  const descriptor = { name: field.name, kind: field.kind };
  if (config.mode === 'sentences' && descriptionEnabled(config)) {
    descriptor.description = fieldDescription(field);
  }
  if (config.mode === 'sentences' && config.combine === 'group-mean') { descriptor.group = groupName(field, config.fieldGroups); }
  return descriptor;
}

function featureSettings(model, method) {
  const fields = featureFields(model);
  const lexical = ['text', 'words'].includes(model.config.mode);
  return { revision: model.revision, sentence: { model: model.config.sentenceModel ?? defaultSentenceModel(model.config.language), chunking: model.config.sentenceChunking,
    size: model.config.sentenceChunkSize, overlap: model.config.sentenceOverlap },
    fields: fields.map(field => featureDescriptor(field, model.config)), method, mode: model.config.mode,
    stopwords: lexical ? stopwordList(model.phraseConfig ?? model.config, true) : [],
    phrases: lexical ? model.phraseConfig ?? null : null, vectorLanguage: model.config.vectorLanguage,
    pooling: model.config.pooling, combine: model.config.combine, weights: model.config.weights,
    includeDescriptions: descriptionEnabled(model.config), groupIdentity: model.config.groupIdentity };
}

export function featureKey(model) {
  const revisions = featureFields(model).map(field => model.fieldRevisions.get(field.name) ?? 0);
  return JSON.stringify([model.schemaRevision, revisions, featureSettings(model, 'prepare')]);
}

function featureValue(value, field, mode) {
  if (missing(value, field)) { return null; }
  if (mode === 'table' && (field.kind === 'number' || temporal(field))) { return numberOf(value, field); }
  return value;
}

export function payload(model, method) {
  const fields = featureFields(model);
  const rows = model.rows.map(row => Object.fromEntries(fields.map(field => [field.name,
    featureValue(row[field.name], field, model.config.mode)])));
  return { ...featureSettings(model, method), rows };
}
