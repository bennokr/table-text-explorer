import { $ } from './dom.js';
import { axisCoordinates, isPointView } from './view-config.js';

function projections(model) {
  return model.views.filter(view => isPointView(view.type)).map(view => {
    const result = view.type === 'scatter' ? axisCoordinates(model, view) : model.resultFor(view);
    if (!result) { return null; }
    return { method: result.method ?? 'axes', count: result.count,
      coordinates: result.x.values.slice(0, 4), config: result.config,
      dimensions: result.dimensions, coverage: result.coverage, rows: result.x.values.length };
  });
}

// Aggregate diagnostics for local browser checks. No complete records are exposed.
export function diagnostics(model, analysis) {
  window.explorer = { snapshot: () => {
    const points = projections(model);
    return { rows: model.rows.length, visible: model.visible.length,
      selected: [...model.selected], active: model.active,
      fields: model.fields.map(({ name, kind, unique }) => ({ name, kind, cardinality: unique.length })),
      views: model.views.map(({ id, type, x, y, color }) => ({ id, type, x, y, color })),
      projection: points[0]?.method ?? 'axes', fittedRows: points[0]?.rows ?? 0,
      coordinates: points[0]?.coordinates, projections: points,
      progress: { visible: !$('#task-progress').hidden, value: $('#task-progress').value,
        determinate: $('#task-progress').hasAttribute('value'), message: $('#status').textContent },
      runtime: { ...analysis.workers.runtime }, busy: Boolean(analysis.workers.pending), analysisBusy: model.analysisBusy, revision: model.revision };
  } };
}
