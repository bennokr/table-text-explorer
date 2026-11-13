import { temporal } from './dates.js';
import { missing, numberOf } from './schema.js';
import { fieldDescription } from './field-metadata.js';
import { descriptionEnabled, groupName } from './group-vectors.js';
import { defaultSentenceModel } from './sentence-models.js';
import { lexiconFor } from './lexicon.js';

export const isEmbeddingMode = mode => ['words', 'sentences'].includes(mode);

export function featureCandidates(model) {
  return model.fields.filter(field => !field.derived).filter(field => model.config.mode !== 'table'
    ? field.storage === 'string' && !field.identifier
    : field.kind !== 'empty' && field.kind !== 'text' && !field.identifier);
}

// The default text field is the one with the most words per record that differ between records: long, and
// not a label repeated over many records (a dossier title is shared by dozens of motions).
function wordsPerValue(field) {
  const sample = (field.unique ?? []).slice(0, 100);
  if (!sample.length) { return 0; }
  const words = sample.reduce((total, value) => total + String(value).split(/\s+/u).length, 0) / sample.length;
  return words * Math.min(1, (field.unique.length / (field.count || field.unique.length)) * 2);
}

export function featureFields(model) {
  const candidates = featureCandidates(model);
  if (Array.isArray(model.config.features)) {
    return candidates.filter(field => model.config.features.includes(field.name));
  }
  const automatic = candidates.filter(field => !field.annotation);
  if (model.config.mode === 'table') { return automatic; }
  const text = automatic.filter(field => field.kind === 'text').sort((a, b) => wordsPerValue(b) - wordsPerValue(a));
  return (text.length ? text : automatic).slice(0, 1);
}

// The words a text index leaves out, from the language's stop list and the user's own additions.
export const stopwordList = config => lexiconFor(config).stop;

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
    stopwords: lexical ? stopwordList(model.phraseConfig ?? model.config) : [],
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
