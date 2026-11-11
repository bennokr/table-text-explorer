import { Events } from './events.js';
// Example presentation defaults never masquerade as field semantics.
export function demoSettings(model, demo) {
  if (!demo) { return; }
  model.configure({ ...model.config, ...demo.analysis });
  if (!demo.views) { return; }
  const names = new Set(model.fields.map(field => field.name));
  model.views = demo.views.filter(view => [view.x, view.y, view.color].filter(Boolean).every(name => names.has(name)))
    .map((view, index) => ({ color: '', title: '', ...view, id: `view-${index + 1}` }));
  model.viewSequence = model.views.length;
  model.emit(Events.VIEWS);
}
