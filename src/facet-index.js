import { facetField } from './facet-predicates.js';

// One dataset/schema snapshot; brushing and filtering never change the candidates.
// The worker holds sparse presence columns, separately from lexical counts.
export class FacetIndex {
  version = 0;
  fields = null;
  sent = null;

  constructor(model) {
    this.model = model;
    for (const event of ['data', 'schema', 'annotation', 'results']) {
      model.on(event, () => { this.version += 1; this.fields = null; this.sent = null; });
    }
  }

  get key() { return `${this.model.revision}:${this.version}`; }

  request(epoch) {
    const base = { key: this.key, rows: this.model.rows.length };
    if (this.sent === `${epoch}:${base.key}`) { return base; }
    this.fields ??= this.model.fields.filter(field => !field.identifier && !field.derived)
      .map(field => facetField(field, this.model.rows)).filter(field => field.predicates.length);
    return { ...base, fields: this.fields };
  }

  accept(request, epoch) {
    if (request?.key === this.key) { this.sent = `${epoch}:${request.key}`; }
  }
}
