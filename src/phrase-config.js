import { featureFields, stopwordList } from './features.js';

export function retainPhraseSettings(model) {
  if (model.phraseConfig) { return; }
  const current = phraseSettings(model);
  model.phraseConfig = { fields: current.fields, sizes: current.sizes,
    language: model.config.language, stopwords: model.config.stopwords };
}

export function phraseSettings(model) {
  const config = model.phraseConfig ?? { sizes: [1, 3], language: model.config.language,
    stopwords: model.config.stopwords, fields: null };
  const fields = config.fields ?? featureFields({ fields: model.fields,
    config: { ...model.config, mode: 'text', features: model.config.mode === 'table' ? null : model.config.features } }).map(field => field.name);
  const eligible = new Set(model.fields.filter(field => !field.annotation && !field.derived).map(field => field.name));
  return { fields: fields.filter(name => eligible.has(name)), sizes: config.sizes, stopwords: stopwordList(config, true) };
}
