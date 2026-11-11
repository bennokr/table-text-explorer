import './variable-picker.js';
import { variableOptions } from './variable-options.js';
import { $, element, options } from './dom.js';
import { phraseSettings } from './phrase-config.js';
import { Events } from './events.js';

export class PhraseSettings {
  constructor(model, analysis) {
    this.model = model;
    this.indexes = analysis.textIndexes;
    $('#phrase-settings').onclick = () => this.open();
    $('#terms-config').onchange = () => this.restore();
    $('#terms-save').onclick = () => this.save();
    $('#phrase-form').onsubmit = event => { event.preventDefault(); this.apply(); };
    model.on(Events.BUSY, () => {
      $('#phrase-controls').disabled = model.analysisBusy;
      $('#phrase-apply').disabled = model.analysisBusy;
    });
  }

  open() {
    const config = this.model.phraseConfig ?? { ...this.model.config, sizes: [1, 3], fields: phraseSettings(this.model).fields };
    const fields = this.model.fields.filter(field => field.storage === 'string' && !field.identifier && !field.annotation && !field.derived);
    $('#terms-fields').variables = variableOptions(fields, this.model.rows.length);
    this.fill(config);
    options($('#terms-config'), [['', 'Current settings'], ...[...this.indexes.configurations.values()].map(item => [item.id, item.name])]);
    $('#phrase-error').textContent = '';
    $('#phrase-dialog').showModal();
  }

  // The select offers three presets. A setting outside them (an older saved preset) gets a one-off
  // option, so it is shown and kept instead of silently replaced.
  showSizes(sizes) {
    const select = $('#terms-sizes');
    const value = sizes.join(':');
    for (const extra of select.querySelectorAll('option[data-custom]')) { extra.remove(); }
    if (![...select.options].some(option => option.value === value)) {
      select.append(element('option', { value, text: `${sizes[0]}–${sizes[1]} words (custom)`, 'data-custom': '' }));
    }
    select.value = value;
  }

  fill(config) {
    this.showSizes(config.sizes);
    $('#terms-language').value = config.language;
    $('#terms-stopwords').value = config.stopwords;
    $('#terms-fields').selected = config.fields;
  }

  read() {
    return { fields: $('#terms-fields').selected,
      sizes: $('#terms-sizes').value.split(':').map(Number), language: $('#terms-language').value,
      stopwords: $('#terms-stopwords').value };
  }

  restore() {
    const saved = this.indexes.configurations.get($('#terms-config').value);
    if (saved) { this.fill(saved.settings); }
  }

  save() {
    const config = this.read();
    const saved = this.indexes.saveConfiguration($('#terms-name').value.trim() || config.fields.join('+') || 'Phrases', config);
    options($('#terms-config'), [...this.indexes.configurations.values()].map(item => [item.id, item.name]), saved.id);
    $('#terms-name').value = '';
  }

  apply() {
    if (this.model.analysisBusy) { return; }
    const config = this.read();
    if (!config.fields.length && this.model.rows.length) { $('#phrase-error').textContent = 'Choose at least one text field.'; return; }
    this.model.phraseConfig = config;
    this.model.emit(Events.PHRASE_SETTINGS);
    $('#phrase-dialog').close();
  }
}
