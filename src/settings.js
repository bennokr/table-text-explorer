import { $ } from './dom.js';
import { sentenceSettings } from './sentence-vectors.js';
import { featureFields } from './features.js';
import { columnTypes } from './column-types.js';
import { featureList, readMapConfig, fillMapConfig } from './map-form.js';
import { mapName, suggestName, uniqueAnalysisName } from './analysis-names.js';
import { combiningControls } from './map-fields.js';
import { retainPhraseSettings } from './phrase-config.js';

function revealInvalidControl(event) {
  for (let parent = event.target.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === 'DETAILS') { parent.open = true; }
  }
}

class SimilarityMaps {
  constructor(model, projection) {
    this.model = model;
    this.projection = projection;
    $('#feature-mode').onchange = () => { featureList(model, this.base); this.name(); };
    $('#field-combine').onchange = combiningControls;
    $('#group-identity').oninput = combiningControls;
    $('#shared-fields').onclick = () => $('#phrase-settings').click();
    model.on('phrase-settings', () => {
      if ($('#map-dialog').open && ['text', 'words'].includes($('#feature-mode').value)) { featureList(model, this.base); this.name(); }
    });
    $('#map-method').onchange = () => this.controls();
    $('#map-form').onchange = () => this.name();
    $('#map-form').oninput = event => { if (event.target.id !== 'map-name') { this.name(); } };
    $('#map-form').onsubmit = event => { event.preventDefault(); this.make(); };
  }

  context(view) {
    const isMap = view && view.type === 'map';
    const saved = isMap ? this.model.resultFor(view) : null;
    this.targetViewId = isMap && !saved ? view.id : null;
    this.base = saved ? saved.config : this.model.config;
    return saved ? saved.method : this.model.config.mapMethod || 'umap';
  }

  open(view) {
    const method = this.context(view);
    fillMapConfig(this.model, this.base, method);
    for (const details of $('#map-form').querySelectorAll('[data-map-fold]')) { details.open = false; }
    $('#map-name').value = '';
    $('#map-error').textContent = '';
    this.controls();
    this.name();
    $('#map-dialog').showModal();
  }

  controls() {
    $('#umap-options').hidden = $('#map-method').value !== 'umap';
    for (const control of $('#umap-options').querySelectorAll('input')) { control.disabled = $('#umap-options').hidden; }
    this.name();
  }

  name() {
    suggestName($('#map-name'), mapName(this.model, readMapConfig(this.model), $('#map-method').value));
  }

  async make() {
    if (this.model.analysisBusy) { return; }
    const config = readMapConfig(this.model);
    if (!featureFields({ fields: this.model.fields, config }).length) {
      $('#map-error').textContent = 'Choose at least one input column.';
      return;
    }
    try {
      if (config.mode === 'sentences') { sentenceSettings({ chunking: config.sentenceChunking, size: config.sentenceChunkSize, overlap: config.sentenceOverlap }); }
    } catch (error) { $('#map-error').textContent = error.message; return; }
    const request = { method: config.mapMethod, name: uniqueAnalysisName(this.model, $('#map-name').value.trim()),
      targetViewId: this.targetViewId };
    retainPhraseSettings(this.model);
    this.model.configure(config);
    $('#map-dialog').close();
    await this.projection.fit(request);
  }
}

export function settings(model, projection, status) {
  document.addEventListener('invalid', revealInvalidControl, true);
  const maps = new SimilarityMaps(model, projection);
  columnTypes(model, status);
  for (const button of document.querySelectorAll('[data-close]')) {
    button.onclick = () => button.closest('dialog').close();
  }
  return view => maps.open(view);
}
