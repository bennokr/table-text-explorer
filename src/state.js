import { inferSchema } from './schema.js';

export class Dataset extends EventTarget {
  rows = [];
  fields = [];
  visible = [];
  selected = new Set();
  annotations = new Set();
  active = null;
  query = () => true;
  pinned = null;
  revision = 0;
  config = { categoryLimit: 50, overrides: {}, mode: 'table', language: 'nl',
    features: null, stopwords: '', neighbors: 15, epochs: 150 };

  emit(type) { this.dispatchEvent(new Event(type)); }
  on(type, callback) {
    this.addEventListener(type, callback);
    return () => this.removeEventListener(type, callback);
  }

  load({ rows, metadata = {}, name }) {
    this.rows = rows.map(row => Object.assign(Object.create(null), row));
    this.metadata = metadata;
    this.name = name;
    this.revision += 1;
    this.fields = inferSchema(this.rows, metadata, { categoryLimit: this.config.categoryLimit });
    this.config.overrides = {};
    this.config.features = null;
    this.annotations.clear();
    this.selected = new Set();
    this.active = rows.length ? 0 : null;
    this.query = () => true;
    this.pinned = null;
    this.sort = null;
    this.coordinates = null;
    this.visible = rows.map((_, index) => index);
    this.emit('data');
  }

  refresh() {
    this.visible = this.rows.flatMap((row, id) => this.query(row) &&
      (!this.pinned || this.pinned.has(id)) ? [id] : []);
    if (this.sort) { this.visible.sort(this.sort); }
    if (!this.visible.includes(this.active)) { this.active = this.visible[0] ?? null; }
    this.emit('view');
  }

  select(ids, active = ids[0]) {
    const next = new Set(ids.filter(id => Number.isInteger(id) && id >= 0 && id < this.rows.length));
    const changed = next.size !== this.selected.size || [...next].some(id => !this.selected.has(id));
    this.selected = next;
    if (active !== undefined) { this.active = active; }
    if (changed || active !== undefined) { this.emit('selection'); }
  }

  configure(config) {
    this.config = config;
    this.fields = inferSchema(this.rows, this.metadata, config);
    this.fields = this.fields.map(field => this.annotations.has(field.name)
      ? { ...field, kind: 'categorical', annotation: true } : field);
    this.emit('schema');
    this.refresh();
  }

  annotate(name, ids, label) {
    for (const id of ids) { this.rows[id][name] = label || null; }
    const field = this.fields.find(field => field.name === name);
    field.unique = [...new Set(this.rows.map(row => row[name]).filter(value => value !== null))];
    field.missing = this.rows.filter(row => row[name] === null).length;
    this.emit('annotation');
    this.refresh();
  }

  addAnnotation(name) {
    if (!name.trim() || this.fields.some(field => field.name === name)) {
      throw new Error('Choose a new, nonempty column name.');
    }
    for (const row of this.rows) { Object.defineProperty(row, name, { value: null,
      enumerable: true, writable: true, configurable: true }); }
    this.annotations.add(name);
    this.fields.push({ name, kind: 'categorical', unique: [], missing: this.rows.length,
      identifier: false, storage: 'string', valueLabels: [], annotation: true });
    this.emit('schema');
    this.refresh();
  }
}
