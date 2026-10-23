import { $, options } from './dom.js';
import { numberOf, categorical } from './schema.js';
import { Workers } from './workers/client.js';

export function featureCandidates(model) {
  return model.fields.filter(field => model.config.mode === 'text'
    ? field.storage === 'string' && !field.identifier
    : field.kind !== 'empty' && field.kind !== 'text' && !field.identifier);
}

export function featureFields(model) {
  const candidates = featureCandidates(model);
  if (Array.isArray(model.config.features)) {
    return candidates.filter(field => model.config.features.includes(field.name));
  }
  const automatic = candidates.filter(field => !field.annotation);
  if (model.config.mode !== 'text') { return automatic; }
  const text = automatic.filter(field => field.kind === 'text');
  return (text.length ? text : automatic).slice(0, 1);
}

const stopwords = {
  nl: 'de het een en van in op te dat die is was voor met aan er om als ik je hij zij wij niet maar ook dan dit zijn wordt door bij naar tot uit heeft hebben',
  en: 'the a an and of in on to that is was for with at as I you he she we not but also then this are be by from has have',
  none: '',
};

function payload(model, method) {
  const fields = featureFields(model);
  const rows = model.rows.map(row => Object.fromEntries(fields.map(field => [field.name,
    ['number', 'date'].includes(field.kind) && model.config.mode === 'table'
      ? numberOf(row[field.name], field) : row[field.name] ?? null])));
  const words = `${stopwords[model.config.language]} ${model.config.stopwords}`.toLowerCase();
  return { rows, fields: fields.map(({ name, kind }) => ({ name, kind })), method, mode: model.config.mode,
    stopwords: [...new Set(words.split(/[\s,]+/u).filter(Boolean))] };
}

export class Projection {
  workers = new Workers();
  generation = 0;

  constructor(model, status) {
    this.model = model;
    this.status = status;
    $('#fit').onclick = () => this.fit();
    $('#cancel').onclick = () => this.workers.cancel();
    $('#projection').onchange = () => {
      if ($('#projection').value === 'axes') { this.axes(); }
    };
    for (const id of ['x-axis', 'y-axis']) { $(`#${id}`).onchange = () => this.axes(); }
    model.on('data', () => {
      this.generation += 1;
      this.workers.cancel();
      $('#x-axis').value = '';
      $('#y-axis').value = '';
      this.controls();
      this.axes();
    });
    model.on('schema', () => { this.controls(); if (!model.coordinates?.fitted) { this.axes(); } });
    model.on('coordinates', () => { $('.axis-controls').hidden = Boolean(model.coordinates?.fitted); });
    this.controls();
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
    this.model.coordinates = { x: axis('x-axis'), y: axis('y-axis'), fitted: false };
    this.model.emit('coordinates');
  }

  async fit() {
    const method = $('#projection').value;
    if (method === 'axes') { this.axes(); return; }
    if (!featureFields(this.model).length) { this.status('Choose feature columns in Settings.', true); return; }
    const generation = this.generation;
    const started = performance.now();
    this.busy(true);
    try {
      const result = await this.workers.run('python', payload(this.model, method), this.status);
      const projected = method === 'umap' ? await this.workers.run('umap', {
        features: result.features, neighbors: this.model.config.neighbors,
        epochs: this.model.config.epochs }, this.status) : result;
      if (generation !== this.generation) { return; }
      const coordinates = projected.coordinates;
      this.model.coordinates = { fitted: true, method,
        x: { values: coordinates.map(point => point[0]), name: `${method.toUpperCase()} 1` },
        y: { values: coordinates.map(point => point[1]), name: `${method.toUpperCase()} 2` } };
      this.model.emit('coordinates');
      this.status(`${method.toUpperCase()} · ${coordinates.length} records · ${((performance.now() - started) / 1000).toFixed(1)}s`);
    } catch (error) { if (generation === this.generation) { this.status(error.message, true); } }
    finally { this.busy(false); }
  }

  busy(value) {
    $('#fit').disabled = value;
    $('#projection').disabled = value;
    $('#settings').disabled = value;
    $('#x-axis').disabled = value;
    $('#y-axis').disabled = value;
    $('#cancel').hidden = !value;
    $('#scatter-panel').setAttribute('aria-busy', String(value));
  }
}
