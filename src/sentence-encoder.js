import { embedRecords } from './sentence-batches.js';
import { sentenceSettings, sentenceText, sentencePrefix, combineSentenceFields, sentenceModel } from './sentence-vectors.js';
import { descriptionEnabled } from './group-vectors.js';

// Worker-local LRU cache: bounded, session-only, and never persisted with table data.
export class SentenceEncoder {
  cache = new Map();
  bytes = 0;
  revision = null;

  constructor(tokenize, infer, limit = 128 * 1024 * 1024, model = sentenceModel) {
    this.tokenize = tokenize;
    this.infer = infer;
    this.limit = limit;
    this.model = model;
  }

  remember(field, entry) {
    this.bytes -= this.cache.get(field)?.bytes ?? 0;
    this.cache.delete(field);
    if (entry.bytes > this.limit) { return; }
    this.cache.set(field, entry);
    this.bytes += entry.bytes;
    while (this.bytes > this.limit) {
      const oldest = this.cache.keys().next().value;
      this.bytes -= this.cache.get(oldest).bytes;
      this.cache.delete(oldest);
    }
  }

  async field(payload, field, settings, report) {
    const texts = payload.rows.map(row => sentenceText(row[field.name]));
    const prefix = descriptionEnabled(payload) ? sentencePrefix(field, settings, this.tokenize) : [];
    const key = JSON.stringify([settings, prefix, texts]);
    const cached = this.cache.get(field.name);
    if (cached?.key === key) {
      this.remember(field.name, cached);
      report({ message: `Reusing sentence vectors · ${field.name}`, completed: texts.length, total: texts.length });
      return cached;
    }
    const { values, coverage } = await embedRecords(texts, { ...settings, prefix, dimensions: this.model.dimensions }, this.tokenize, this.infer,
      update => report({ message: `Embedding sentences · ${field.name}`, ...update }));
    if (prefix.length) { coverage.descriptionTokensPerChunk = prefix.length; }
    const result = { key, values, coverage, bytes: values.byteLength + key.length * 2 };
    this.remember(field.name, result);
    return result;
  }

  async embed(payload, report) {
    const settings = sentenceSettings(payload.sentence, this.model);
    if (payload.revision !== this.revision) { this.cache.clear(); this.bytes = 0; this.revision = payload.revision; }
    if (!payload.fields.length) { throw new Error('Choose at least one sentence text field.'); }
    const results = [];
    for (const field of payload.fields) { results.push(await this.field(payload, field, settings, report)); }
    return combineSentenceFields(payload, results, this.model);
  }
}
