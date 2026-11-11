import { Events } from './events.js';
// Example presentation defaults never masquerade as field semantics.
// `embedding` is the example's own precomputed embedding, when it shipped one: the map form then starts from it.
export function demoSettings(model, demo, embedding = null) {
  if (!demo) { return; }
  const fromEmbedding = embedding ? { mode: 'sentences', features: [embedding.field], sentenceModel: embedding.key } : {};
  model.configure({ ...model.config, ...demo.analysis, ...fromEmbedding });
  if (!demo.views) { return; }
  const names = new Set(model.fields.map(field => field.name));
  model.views = demo.views.filter(view => [view.x, view.y, view.color].filter(Boolean).every(name => names.has(name)))
    .map((view, index) => ({ color: '', title: '', ...view, id: `view-${index + 1}` }));
  model.viewSequence = model.views.length;
  model.emit(Events.VIEWS);
}
