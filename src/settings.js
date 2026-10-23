import { $, element, options } from './dom.js';
import { featureCandidates, featureFields } from './projection.js';

function featureList(model) {
  const config = { ...model.config, mode: $('#feature-mode').value };
  if (config.mode !== model.config.mode) { config.features = null; }
  const temporary = { fields: model.fields, config };
  const selected = new Set(featureFields(temporary).map(field => field.name));
  $('#feature-list').replaceChildren(...featureCandidates(temporary).map(field =>
    element('label', {}, [element('input', { type: 'checkbox', name: 'feature', value: field.name,
      ...(selected.has(field.name) ? { checked: '' } : {}) }),
    document.createTextNode(`${field.name} · ${field.kind}`)])));
}

function fieldTable(model) {
  $('#field-types').replaceChildren(...model.fields.map(field => {
    const select = element('select', { 'data-field': field.name, 'aria-label': `Type of ${field.name}` });
    options(select, [['', `Auto · ${field.kind}`], ...['number', 'categorical', 'boolean', 'date', 'text'].map(type => [type, type])],
      model.config.overrides[field.name] ?? '');
    return element('tr', {}, [element('th', { text: field.name, title: field.label ?? '', scope: 'row' }),
      element('td', {}, [select]), element('td', { text: field.unique.length }),
      element('td', { text: field.missing })]);
  }));
}

export function settings(model, status) {
  $('#settings').onclick = () => {
    $('#category-limit').value = model.config.categoryLimit;
    $('#feature-mode').value = model.config.mode;
    $('#language').value = model.config.language;
    $('#stopwords').value = model.config.stopwords;
    $('#neighbors').value = model.config.neighbors;
    $('#epochs').value = model.config.epochs;
    featureList(model);
    fieldTable(model);
    $('#settings-dialog').showModal();
  };
  $('#feature-mode').onchange = () => featureList(model);
  $('#settings-form').onsubmit = event => {
    event.preventDefault();
    const overrides = Object.fromEntries([...$('#field-types').querySelectorAll('select')]
      .filter(select => select.value).map(select => [select.dataset.field, select.value]));
    model.configure({ categoryLimit: Number($('#category-limit').value), overrides,
      mode: $('#feature-mode').value, language: $('#language').value,
      features: [...$('#feature-list').querySelectorAll('input:checked')].map(input => input.value),
      stopwords: $('#stopwords').value, neighbors: Number($('#neighbors').value),
      epochs: Number($('#epochs').value) });
    $('#settings-dialog').close();
    status('Settings applied. Existing fitted coordinates are retained until you fit again.');
  };
  for (const button of document.querySelectorAll('[data-close]')) {
    button.onclick = () => button.closest('dialog').close();
  }
}
