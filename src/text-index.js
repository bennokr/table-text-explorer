// Descriptors contain settings, never text. Sparse matrices live in the Python worker.
export class TextIndexes {
  entries = new Map();
  configurations = new Map();
  configurationSequence = 0;
  activeId = null;
  generation = 0;

  constructor(model, run) {
    this.model = model;
    this.run = run;
    model.on('data', () => { this.clear(); this.configurations.clear(); });
  }

  clear() { this.generation += 1; this.entries.clear(); this.activeId = null; }

  saveConfiguration(name, settings) {
    const names = new Set([...this.configurations.values()].map(config => config.name));
    let unique = name;
    let suffix = 2;
    while (names.has(unique)) {
      unique = `${name} ${suffix}`;
      suffix += 1;
    }
    const config = { id: `text-index-${++this.configurationSequence}`, name: unique,
      settings: structuredClone(settings) };
    this.configurations.set(config.id, config);
    return config;
  }

  key(settings) {
    return JSON.stringify([this.model.revision, [...settings.fields].sort(),
      settings.sizes, [...new Set(settings.stopwords)].sort()]);
  }

  get(settings) { return this.entries.get(this.key(settings)); }

  async ensure(settings, progress) {
    const generation = this.generation;
    const indexId = this.key(settings);
    if (this.entries.has(indexId)) { return this.entries.get(indexId); }
    const columns = settings.fields.map(name => ({ name, texts: this.model.rows.map(row => row[name] ?? '') }));
    const output = await this.run({ task: 'terms_build', ...settings, indexId, columns,
      rows: this.model.rows.length, revision: this.model.revision, protectedIndexId: this.activeId }, progress);
    if (generation !== this.generation) { throw new Error('Text index build cancelled.'); }
    const entry = { ...output, indexId };
    this.entries.set(indexId, entry);
    this.trim(indexId);
    this.model.emit('text-index');
    return entry;
  }

  trim(latest) {
    for (const identity of this.entries.keys()) {
      if (this.entries.size <= 4) { break; }
      if (![this.activeId, latest].includes(identity)) { this.entries.delete(identity); }
    }
  }
}
