import './variable-picker.js';
import { variableOptions } from './variable-options.js';
import { phraseSettings } from './phrase-config.js';
import { availableSentenceModel, refreshChoices } from './embedding-import.js';
import { fieldCombinationOptions } from './sentence-vectors.js';
import { $, options } from './dom.js';
import { featureCandidates, featureFields, isEmbeddingMode } from './features.js';
import { descriptionEnabled } from './group-vectors.js';
import { mapMethod, methodChoice } from './map-method.js';
import { defaultSurvey } from './default-config.js';
import { isText, stateCounts } from './survey-input.js';
import { resetFieldOptions, readFieldOptions, renderFieldOptions, combiningControls } from './map-fields.js';

// Which parts of the dialog a mode needs. Survey answers embed free text only when a text column is chosen.
function showSections(model, mode, selected) {
  const survey = mode === 'survey';
  const hasText = selected.some(name => isText(model.fields.find(field => field.name === name)));
  $('#word-options').hidden = mode !== 'words';
  $('#sentence-options').hidden = !(mode === 'sentences' || (survey && hasText));
  $('#embedding-options').hidden = !(isEmbeddingMode(mode) || survey);
  $('#survey-options').hidden = !survey;
  for (const id of ['word-options', 'sentence-options', 'embedding-options', 'survey-options']) {
    const section = $(`#${id}`);
    for (const control of section.querySelectorAll('input,select,textarea')) { control.disabled = section.hidden; }
  }
}

// What the blank cells of the chosen columns are: the routing rules of the codebook decide between skipped and not shown.
function missingSummary(model, selected) {
  const fields = selected.map(name => model.fields.find(field => field.name === name));
  const counts = stateCounts(model, fields);
  if (!counts.rules) { return 'No routing rules in the codebook · blank answers are skipped, never a difference'; }
  const blanks = [`${counts.notShown.toLocaleString()} not shown`, `${counts.skipped.toLocaleString()} skipped`, `${counts.unknown.toLocaleString()} unknown`];
  return `${counts.rules} columns have routing rules · ${blanks.join(' · ')}`;
}

export function featureList(model, base) {
  const config = { ...base, mode: $('#feature-mode').value };
  options($('#field-combine'), fieldCombinationOptions(config.mode), $('#field-combine').value);
  if (config.mode !== base.mode) { config.features = null; }
  const temporary = { fields: model.fields, config };
  const lexical = ['text', 'words'].includes(config.mode);
  const selected = lexical ? phraseSettings(model).fields : featureFields(temporary).map(field => field.name);
  $('#lexical-settings-note').hidden = !lexical;
  $('#feature-list').hidden = lexical;
  $('#shared-fields').textContent = `${selected.length} shared text columns · Change phrase settings`;
  const picker = $('#feature-list');
  picker.variables = variableOptions(featureCandidates(temporary), model.rows.length);
  picker.selected = selected;
  const refresh = () => {
    showSections(model, config.mode, picker.selected);
    if (config.mode === 'survey') { $('#survey-missing-summary').textContent = missingSummary(model, picker.selected); }
    renderFieldOptions(model, picker.selected, config.mode);
  };
  picker.onchange = refresh;
  refresh();
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
    groupIdentity: Number($('#group-identity').value) / 100, ...readFieldOptions(),
    survey: { textWeight: Number($('#survey-text-weight').value) / 100, balance: $('#survey-balance').checked,
      common: $('#survey-common').checked } };
}

export function fillMapConfig(model, config, method) {
  const combine = config.combine === 'description-mean' ? 'mean' : config.combine;
  options($('#field-combine'), fieldCombinationOptions(config.mode), combine);
  resetFieldOptions(config);
  $('#include-descriptions').checked = descriptionEnabled(config);
  $('#group-identity').value = Math.round(100 * (config.groupIdentity ?? 0.2));
  const survey = { ...defaultSurvey(), ...config.survey };
  $('#survey-text-weight').value = Math.round(100 * survey.textWeight);
  $('#survey-balance').checked = survey.balance;
  $('#survey-common').checked = survey.common;
  const sentenceModel = availableSentenceModel(model, config);
  refreshChoices(model, sentenceModel);
  const controls = { 'feature-mode': config.mode,
    neighbors: config.neighbors, epochs: config.epochs, 'vector-language': config.vectorLanguage,
    'sentence-model': sentenceModel, 'sentence-chunking': config.sentenceChunking,
    'word-pooling': config.pooling, 'field-combine': combine, 'map-method': methodChoice(method) };
  for (const [id, value] of Object.entries(controls)) { $(`#${id}`).value = value; }
  featureList(model, config);
}
