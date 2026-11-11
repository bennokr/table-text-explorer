import { defaultConfig, defaultInputMode } from './default-config.js';
import { inferSchema } from './schema.js';
import { Results } from './results.js';
import { Events, checkedEvent } from './events.js';
import { defaultTermSettings } from './term-settings-model.js';

export class Dataset extends EventTarget {
  rows = [];
  tableColumns = null;
  fields = [];
  visible = [];
  selected = new Set();
  annotations = new Set();
  populations = new Map(); // Records highlighted before each path condition, keyed by condition index.
  active = null;
  query = () => true;
  pinned = null;
  revision = 0;
  schemaRevision = 0;
  fieldRevisions = new Map();
  views = [];
  viewSequence = 0;
  analysisViewId = null;
  results = new Results();
  analysisBusy = false;
  fittingViewId = null;
  fitProgress = null;
  config = defaultConfig();
  termSettings = defaultTermSettings();

  emit(type) { this.dispatchEvent(new Event(checkedEvent(type))); }
  on(type, callback) {
    this.addEventListener(checkedEvent(type), callback);
    return () => this.removeEventListener(type, callback);
  }

  load({ rows, metadata = {}, name }) {
    this.rows = rows.map(row => Object.assign(Object.create(null), row));
    this.metadata = metadata;
    this.tableColumns = null;
    this.config = defaultConfig();
    this.name = name;
    this.revision += 1;
    this.fieldRevisions.clear();
    this.fields = inferSchema(this.rows, metadata, this.config);
    this.config.overrides = {};
    this.config.mode = defaultInputMode(this.fields);
    this.config.features = null;
    this.phraseConfig = null;
    this.annotations.clear();
    this.selected = new Set();
    this.active = rows.length ? 0 : null;
    this.query = () => true;
    this.pinned = null;
    this.sort = null;
    this.views = [];
    this.viewSequence = 0;
    this.analysisViewId = null;
    this.fittingViewId = null;
    this.fitProgress = null;
    this.results = new Results();
    this.importedEmbeddings = new Map();
    this.embeddingSequence = 0;
    this.ast = null;
    this.populations = new Map();
    Object.assign(this.termSettings, { compare: 'auto', groupPage: 0 }); // The panel's other settings are kept.
    this.config.weights = {};
    this.visible = rows.map((_, index) => index);
    this.emit(Events.DATA);
  }

  refresh() {
    this.visible = this.rows.flatMap((row, id) => this.query(row) &&
      (!this.pinned || this.pinned.has(id)) ? [id] : []);
    if (this.sort) { this.visible.sort(this.sort); }
    if (!this.visible.includes(this.active)) { this.active = this.visible[0] ?? null; }
    this.emit(Events.VIEW);
  }

  select(ids, active = ids[0]) {
    const next = new Set(ids.filter(id => Number.isInteger(id) && id >= 0 && id < this.rows.length));
    const changed = next.size !== this.selected.size || [...next].some(id => !this.selected.has(id));
    this.selected = next;
    if (active !== undefined) { this.active = active; }
    if (changed || active !== undefined) { this.emit(Events.SELECTION); }
  }

  configure(config) {
    const schemaChanged = config.categoryLimit !== this.config.categoryLimit ||
      config.numericCategoryLimit !== this.config.numericCategoryLimit ||
      JSON.stringify(config.overrides) !== JSON.stringify(this.config.overrides);
    this.config = config;
    if (!schemaChanged) { this.emit(Events.CONFIG); return; }
    this.schemaRevision += 1;
    const derived = this.fields.filter(field => field.derived);
    const originals = this.rows.map(row => Object.fromEntries(Object.entries(row)
      .filter(([name]) => !derived.some(field => field.name === name))));
    this.fields = [...inferSchema(originals, this.metadata, config), ...derived];
    this.fields = this.fields.map(field => this.annotations.has(field.name)
      ? { ...field, kind: 'categorical', annotation: true } : field);
    this.emit(Events.SCHEMA);
    this.refresh();
  }

  nextViewId() { this.viewSequence += 1; return `view-${this.viewSequence}`; }

  resultFor(view) { return this.results.get(view.resultId); }

  resultsChanged({ valuesChanged = true } = {}) {
    if (valuesChanged) {
      for (const field of this.fields.filter(field => field.derived)) {
        const values = this.rows.map(row => row[field.name]);
        field.unique = [...new Set(values.filter(value => value !== null))];
        field.missing = values.filter(value => value === null).length;
      }
    }
    this.emit(Events.RESULTS);
    if (valuesChanged) { this.refresh(); }
  }

  annotate(name, ids, label) {
    if (!this.annotations.has(name)) { throw new Error('Choose an annotation column.'); }
    for (const id of ids) { this.rows[id][name] = label || null; }
    this.fieldRevisions.set(name, (this.fieldRevisions.get(name) ?? 0) + 1);
    const field = this.fields.find(field => field.name === name);
    field.unique = [...new Set(this.rows.map(row => row[name]).filter(value => value !== null))];
    field.missing = this.rows.filter(row => row[name] === null).length;
    this.emit(Events.ANNOTATION);
    this.refresh();
  }

  addAnnotation(name, assignments = new Map()) {
    if (!name.trim() || this.fields.some(field => field.name === name)) {
      throw new Error('Choose a new, nonempty column name.');
    }
    for (const [id, row] of this.rows.entries()) { Object.defineProperty(row, name, { value: assignments.get(id) || null,
      enumerable: true, writable: true, configurable: true }); }
    this.annotations.add(name);
    this.fieldRevisions.set(name, 1);
    this.fields.push({ name, kind: 'categorical', unique: [...new Set(this.rows.map(row => row[name]).filter(Boolean))],
      missing: this.rows.filter(row => row[name] === null).length,
      identifier: false, storage: 'string', valueLabels: [], annotation: true });
    this.emit(Events.SCHEMA);
    this.refresh();
  }
}
