import { $, element, options } from './dom.js';

function fieldTable(model) {
  $('#field-types').replaceChildren(...model.fields.map(field => {
    const select = element('select', { 'data-field': field.name, 'aria-label': `Type of ${field.name}` });
    options(select, [['', `Auto · ${field.kind}`], ...['number', 'categorical', 'boolean', 'date', 'datetime', 'text'].map(type => [type, type])],
      model.config.overrides[field.name] ?? '');
    select.disabled = Boolean(field.derived || field.annotation);
    return element('tr', {}, [element('th', { text: field.name, title: field.label ?? '', scope: 'row' }),
      element('td', {}, [select]), element('td', { text: field.unique.length }),
      element('td', { text: field.missing })]);
  }));
}

export function columnTypes(model, status) {
  $('#column-types').onclick = () => {
    $('#category-limit').value = model.config.categoryLimit;
    $('#numeric-category-limit').value = model.config.numericCategoryLimit;
    fieldTable(model);
    $('#column-types-dialog').showModal();
  };
  $('#column-types-form').onsubmit = event => {
    event.preventDefault();
    const overrides = Object.fromEntries([...$('#field-types').querySelectorAll('select')]
      .filter(select => !select.disabled && select.value).map(select => [select.dataset.field, select.value]));
    model.configure({ ...model.config, categoryLimit: Number($('#category-limit').value),
      numericCategoryLimit: Number($('#numeric-category-limit').value), overrides });
    $('#column-types-dialog').close();
    status('Column types applied. Original values and fitted similarity maps are preserved.');
  };
}
