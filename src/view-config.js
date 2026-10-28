import { temporal } from './dates.js';
import { categorical, numberOf } from './schema.js';

export const viewTypes = [['scatter', 'Scatter'], ['histogram', 'Histogram'],
  ['bar', 'Bars'], ['heatmap', 'Heatmap'], ['map', 'Map'], ['legend', 'Legend']];
export const isResultView = type => ['map', 'legend'].includes(type);
export const isProjection = type => type === 'map';
export const isPointView = type => type === 'scatter' || isProjection(type);

export function eligibleFields(fields, type) {
  const present = fields.filter(field => field.kind !== 'empty');
  if (type === 'bar' || type === 'heatmap') { return present.filter(categorical); }
  if (type === 'histogram') { return present.filter(field => !categorical(field)); }
  return present.filter(field => field.kind !== 'text');
}

function resultViewValid(model, view) {
  const result = model.resultFor(view);
  if (isProjection(view.type)) { return !view.resultId || result?.kind === 'projection'; }
  return result?.kind === 'clustering';
}

export function viewFieldsValid(model, view) {
  if (isResultView(view.type)) { return resultViewValid(model, view); }
  const available = new Set(eligibleFields(model.fields, view.type).map(field => field.name));
  if (view.type === 'scatter') { available.add(''); }
  const names = [view.x];
  if (view.type === 'scatter' || view.type === 'heatmap') { names.push(view.y); }
  return names.every(name => available.has(name));
}

export function viewSchemaKey(model, view) {
  if (isProjection(view.type)) { return ''; }
  return JSON.stringify([view.x, view.y].map(name => {
    const field = model.fields.find(field => field.name === name);
    return field && [field.name, field.kind, field.valueLabels];
  }));
}

function resultForType(model, view, type) {
  const kind = type === 'map' ? 'projection' : 'clustering';
  const result = model.resultFor(view);
  if (result?.kind === kind) { return result.id; }
  return type === 'legend' ? model.results.list(kind)[0]?.id ?? '' : '';
}

export function changeViewType(model, view, type) {
  if (isResultView(type)) { return { type, x: '', y: '', resultId: resultForType(model, view, type) }; }
  const names = eligibleFields(model.fields, type).map(field => field.name);
  const x = names.includes(view.x) ? view.x : names[0] ?? '';
  const y = names.includes(view.y) ? view.y : names[1] ?? names[0] ?? '';
  return { type, x, y: ['scatter', 'heatmap'].includes(type) ? y : '' };
}

export function defaultViews(model) {
  const fields = model.fields.filter(field => field.kind !== 'empty' && !field.identifier);
  const axes = fields.filter(field => (field.kind === 'number' || temporal(field)));
  const category = fields.find(categorical);
  const histogram = fields.find(field => !categorical(field));
  const views = [{ type: 'scatter', x: axes[0]?.name ?? '', y: axes[1]?.name ?? '' }];
  if (category) { views.push({ type: 'bar', x: category.name }); }
  if (histogram) { views.push({ type: 'histogram', x: histogram.name }); }
  return views.map((view, index) => ({ color: '', title: '', ...view, id: `view-${index + 1}` }));
}

export function axisCoordinates(model, view) {
  const axis = name => {
    const field = model.fields.find(field => field.name === name);
    const values = model.rows.map((row, index) => field ? row[name] : index + 1);
    if (field && categorical(field)) { return { values, field, name }; }
    return { values: values.map(value => field ? numberOf(value, field) : value), field, name: name || '# Row' };
  };
  return { x: axis(view.x), y: axis(view.y), fitted: false };
}

function resultTitle(model, view) {
  const result = model?.resultFor(view);
  const fallback = view.type === 'map' ? 'Similarity map' : 'Cluster legend';
  return result?.mapName ?? result?.name ?? fallback;
}

export function viewTitle(view, model) {
  if (view.title) { return view.title; }
  if (isResultView(view.type)) { return resultTitle(model, view); }
  const fields = [view.x || '# Row'];
  if (view.type === 'scatter' || view.type === 'heatmap') { fields.push(view.y || '# Row'); }
  return fields.join(' × ');
}
