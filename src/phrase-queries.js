import { parseQuery } from './query.js';

export class PhraseQueries {
  cache = new Map();
  epoch = 0;
  active = new Set();

  constructor(model, analysis) {
    this.model = model;
    this.analysis = analysis;
    for (const event of ['data', 'annotation', 'results']) {
      model.on(event, () => { this.epoch += 1; this.cache.clear(); });
    }
  }

  key(field, phrase) { return JSON.stringify([field, phrase]); }

  requests(input) {
    const requests = new Map();
    this.active.clear();
    parseQuery(input, this.model.fields, { phrase: (field, phrase) => {
      const key = this.key(field.name, phrase);
      this.active.add(key);
      if (!this.cache.has(key)) { requests.set(key, { field: field.name, phrase }); }
      return () => false;
    } });
    return [...requests.values()];
  }

  columns(names) {
    const entries = [...this.analysis.textIndexes?.entries.values() ?? []];
    const cached = name => entries.some(entry => entry.fields?.some(field => field.name === name));
    return names.filter(name => !cached(name)).map(name => ({ name,
      texts: this.model.rows.map(row => row[name] ?? null) }));
  }

  async prepare(requests) {
    const revision = this.model.revision;
    const epoch = this.epoch;
    const names = [...new Set(requests.map(request => request.field))];
    const columns = this.columns(names);
    const output = await this.analysis.workers.run('python', { task: 'phrase_matches', revision, columns, requests }, this.analysis.progress);
    if (epoch !== this.epoch) { return; }
    for (const match of output.matches) {
      this.cache.set(this.key(match.field, match.phrase), new Set(match.ids.map(id => this.model.rows[id])));
    }
    for (const key of this.cache.keys()) {
      if (this.cache.size <= Math.max(100, this.active.size)) { break; }
      if (!this.active.has(key)) { this.cache.delete(key); }
    }
  }

  context() {
    return { phrase: (field, phrase) => {
      const rows = this.cache.get(this.key(field.name, phrase));
      if (!rows) { throw new Error('Exact phrase matches are not prepared yet.'); }
      return row => rows.has(row);
    } };
  }
}
