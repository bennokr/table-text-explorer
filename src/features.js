import { numberOf } from './schema.js';

export function featureCandidates(model) {
  return model.fields.filter(field => model.config.mode !== 'table'
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

export function payload(model, method) {
  const fields = featureFields(model);
  const rows = model.rows.map(row => Object.fromEntries(fields.map(field => [field.name,
    ['number', 'date'].includes(field.kind) && model.config.mode === 'table'
      ? numberOf(row[field.name], field) : row[field.name] ?? null])));
  const words = `${stopwords[model.config.language]} ${model.config.stopwords}`.toLowerCase();
  return { rows, fields: fields.map(({ name, kind }) => ({ name, kind })), method, mode: model.config.mode,
    stopwords: [...new Set(words.split(/[\s,]+/u).filter(Boolean))],
    vectorLanguage: model.config.vectorLanguage, pooling: model.config.pooling,
    combine: model.config.combine, weights: model.config.weights };
}
