import './variable-picker.js';
import { variableOptions } from './variable-options.js';
import { phraseSettings } from './phrase-config.js';
import { defaultSentenceModel, sentenceModels } from './sentence-models.js';
import { fieldCombinationOptions } from './sentence-vectors.js';
import { $, options } from './dom.js';
import { featureCandidates, featureFields, isEmbeddingMode } from './features.js';
import { descriptionEnabled } from './group-vectors.js';
import { mapMethod, methodChoice } from './map-method.js';
import { resetFieldOptions, readFieldOptions, renderFieldOptions, combiningControls } from './map-fields.js';

export function featureList(model, base) {
  const config = { ...base, mode: $('#feature-mode').value };
  options($('#field-combine'), fieldCombinationOptions(config.mode), $('#field-combine').value);
  if (config.mode !== base.mode) { config.features = null; }
  const temporary = { fields: model.fields, config };
  const lexical = ['text', 'words'].includes(config.mode);
  const selected = lexical ? phraseSettings(model).fields : featureFields(temporary).map(field => field.name);
  $('#word-options').hidden = config.mode !== 'words';
  $('#sentence-options').hidden = config.mode !== 'sentences';
  $('#embedding-options').hidden = !isEmbeddingMode(config.mode);
  $('#lexical-settings-note').hidden = !lexical;
  $('#feature-list').hidden = lexical;
  $('#shared-fields').textContent = `${selected.length} shared text columns · Change phrase settings`;
  for (const id of ['word-options', 'sentence-options', 'embedding-options']) {
    const section = $(`#${id}`);
    for (const control of section.querySelectorAll('input,select,textarea')) { control.disabled = section.hidden; }
  }
  const picker = $('#feature-list');
  picker.variables = variableOptions(featureCandidates(temporary), model.rows.length);
  picker.selected = selected;
  picker.onchange = () => {
    renderFieldOptions(model, picker.selected, config.mode);
  };
  renderFieldOptions(model, selected, config.mode);
  combiningControls();
}

export function readMapConfig(model) {
  return { ...model.config, phrases: phraseSettings(model), mode: $('#feature-mode').value, language: model.config.language,
    features: ['text', 'words'].includes($('#feature-mode').value) ? phraseSettings(model).fields
      : $('#feature-list').selected,
    stopwords: model.config.stopwords, neighbors: Number($('#neighbors').value),
    epochs: Number($('#epochs').value), vectorLanguage: $('#vector-language').value,
    pooling: $('#word-pooling').value, combine: $('#field-combine').value,
    mapMethod: mapMethod($('#map-method').value, $('#feature-mode').value), sentenceChunking: $('#sentence-chunking').value,
    sentenceModel: $('#sentence-model').value,
    includeDescriptions: $('#feature-mode').value === 'sentences' && $('#include-descriptions').checked,
    groupIdentity: Number($('#group-identity').value) / 100, ...readFieldOptions() };
}

export function fillMapConfig(model, config, method) {
  const combine = config.combine === 'description-mean' ? 'mean' : config.combine;
  options($('#field-combine'), fieldCombinationOptions(config.mode), combine);
  resetFieldOptions(config);
  $('#include-descriptions').checked = descriptionEnabled(config);
  $('#group-identity').value = Math.round(100 * (config.groupIdentity ?? 0.2));
  const sentenceModel = config.sentenceModel ?? defaultSentenceModel(config.language);
  options($('#sentence-model'), Object.entries(sentenceModels).map(([key, item]) => [key, item.label]), sentenceModel);
  const controls = { 'feature-mode': config.mode,
    neighbors: config.neighbors, epochs: config.epochs, 'vector-language': config.vectorLanguage,
    'sentence-model': sentenceModel, 'sentence-chunking': config.sentenceChunking,
    'word-pooling': config.pooling, 'field-combine': combine, 'map-method': methodChoice(method) };
  for (const [id, value] of Object.entries(controls)) { $(`#${id}`).value = value; }
  featureList(model, config);
}
