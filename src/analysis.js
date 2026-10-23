import { payload } from './features.js';
import { Workers } from './workers/client.js';

export class Analysis {
  workers = new Workers();

  constructor(model, progress) { this.model = model; this.progress = progress; }

  async prepare() {
    const data = payload(this.model, 'prepare');
    const key = JSON.stringify([this.model.revision, data]);
    if (this.cache?.key === key) { return this.cache.result; }
    let rowIds = this.model.rows.map((_, id) => id), coverage = [];
    if (data.mode === 'words') {
      const embedded = await this.workers.run('words', data, this.progress);
      rowIds = embedded.rowIds;
      coverage = embedded.coverage;
      if (rowIds.length < 2) { throw new Error('Fewer than two records have usable word vectors. Check language, fields and stopwords.'); }
      data.features = embedded.features;
      data.dimensions = embedded.dimensions;
      data.rows = rowIds.map(() => ({}));
    }
    const prepared = await this.workers.run('python', data, this.progress);
    const result = { ...prepared, rowIds, coverage };
    this.cache = { key, result };
    return result;
  }

  async project(method) {
    const prepared = await this.prepare();
    const config = this.model.config;
    const result = await this.workers.run(method === 'umap' ? 'umap' : 'python', {
      method, mode: 'prepared', features: prepared.features,
      neighbors: config.neighbors, epochs: config.epochs }, this.progress);
    return { ...prepared, coordinates: result.coordinates };
  }

  cancel() { this.workers.cancel(); this.cache = null; }
}
