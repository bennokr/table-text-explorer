import { $, options, element } from './dom.js';
import { numberOf, categorical } from './schema.js';
import { featureFields } from './features.js';
import { Analysis } from './analysis.js';
import { progress, complete } from './status.js';

export class Projection {
  generation = 0;

  constructor(model, status) {
    this.model = model;
    this.status = status;
    this.analysis = new Analysis(model, progress);
    this.workers = this.analysis.workers;
    $('#fit').onclick = () => $('#projection').value === 'axes' ? this.axes() : this.fit(0);
    $('#fit-secondary').onclick = () => this.fit(1);
    $('#cancel').onclick = () => { this.cancel(); complete('Analysis cancelled. Existing projections retained.'); };
    $('#compare').onchange = () => {
      $('#compare-controls').hidden = !$('#compare').checked;
      $('#secondary-view').hidden = !$('#compare').checked;
    };
    $('#projection').onchange = () => {
      $('.axis-controls').hidden = $('#projection').value !== 'axes';
      if ($('#projection').value === 'axes') { this.axes(); }
    };
    for (const id of ['x-axis', 'y-axis']) { $(`#${id}`).onchange = () => this.axes(); }
    model.on('data', () => this.reset());
    model.on('schema', () => { this.controls(); if (!model.coordinates?.fitted) { this.axes(); } });
    model.on('coordinates', () => { $('.axis-controls').hidden = $('#projection').value !== 'axes'; });
    this.controls();
  }

  cancel() { this.generation += 1; this.analysis.cancel(); this.busy(false); }

  reset() {
    this.cancel();
    $('#x-axis').value = '';
    $('#y-axis').value = '';
    this.controls();
    this.axes();
  }

  controls() {
    const fields = this.model.fields.filter(field => field.kind !== 'empty' && field.kind !== 'text');
    const preferred = fields.filter(field => ['number', 'date'].includes(field.kind) && !field.identifier);
    const defaults = [...new Set([...preferred, ...fields].map(field => field.name))];
    const entries = [['', '# Row'], ...fields.map(field => [field.name, field.name])];
    for (const [index, id] of ['x-axis', 'y-axis'].entries()) {
      options($(`#${id}`), entries, $(`#${id}`).value || defaults[index] || '');
    }
  }

  axes() {
    if (!this.model.rows.length) { return; }
    $('#projection').value = 'axes';
    const axis = id => {
      const name = $(`#${id}`).value;
      const field = this.model.fields.find(field => field.name === name);
      const values = this.model.rows.map((row, index) => field ? row[name] : index + 1);
      if (field && categorical(field)) { return { values, field, name }; }
      return { values: values.map(value => field ? numberOf(value, field) : value), field, name: name || '# Row' };
    };
    this.save(0, { x: axis('x-axis'), y: axis('y-axis'), fitted: false });
  }

  save(slot, coordinates) {
    this.model.projections[slot] = coordinates;
    if (slot === 0) { this.model.coordinates = coordinates; }
    this.model.emit('coordinates');
  }

  fitted(method, result, config) {
    const positions = new Map(result.rowIds.map((id, index) => [id, result.coordinates[index]]));
    const axis = d => this.model.rows.map((_, id) => positions.get(id)?.[d] ?? NaN);
    return { fitted: true, method, count: result.rowIds.length, config, coverage: result.coverage,
      dimensions: result.dimensions, rowIds: result.rowIds,
      x: { values: axis(0), name: `${method.toUpperCase()} 1` },
      y: { values: axis(1), name: `${method.toUpperCase()} 2` } };
  }

  async fit(slot = 0) {
    const method = $(slot ? '#projection-secondary' : '#projection').value;
    if (!featureFields(this.model).length) { this.status('Choose feature columns in Settings.', true); return; }
    const generation = this.generation;
    const started = performance.now();
    const config = structuredClone(this.model.config);
    this.busy(true);
    try {
      const result = await this.analysis.project(method);
      if (generation !== this.generation) { return; }
      this.save(slot, this.fitted(method, result, config));
      const missing = this.model.rows.length - result.rowIds.length;
      complete(`${method.toUpperCase()} · ${result.rowIds.length} records · ${missing} without vectors · ${((performance.now() - started) / 1000).toFixed(1)}s`);
    } catch (error) { if (generation === this.generation) { complete(error.message, true); } }
    finally { if (generation === this.generation) { this.busy(false); } }
  }

  busy(value) {
    for (const id of ['fit', 'fit-secondary']) {
      $(`#${id}`).replaceChildren(value ? element('span', { class: 'loading-glyph', 'aria-hidden': 'true', text: '◌' })
        : document.createTextNode('▶'));
    }
    for (const id of ['fit', 'fit-secondary', 'projection', 'projection-secondary', 'settings', 'x-axis', 'y-axis']) {
      $(`#${id}`).disabled = value;
    }
    $('#cancel').hidden = !value;
    $('#scatter-panel').setAttribute('aria-busy', String(value));
  }
}
