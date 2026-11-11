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

const MAX_BAR_VALUES = 30;

// Bars work best for a handful of values: prefer 2 to 12, then the column with the fewest gaps.
function barColumns(fields) {
  const count = field => field.unique?.length ?? 0;
  const few = field => count(field) >= 2 && count(field) <= MAX_BAR_VALUES;
  const rank = field => (count(field) <= 12 ? 0 : 1000) + field.missing / 1000 + count(field) / 100;
  return fields.filter(field => categorical(field) && few(field)).sort((a, b) => rank(a) - rank(b));
}

// Views that say something at a glance: the main categories, and how one measure or date is spread.
// A scatter appears only when there are two measures and no categories, never against the row number.
export function defaultViews(model) {
  const fields = model.fields.filter(field => field.kind !== 'empty' && !field.identifier && !field.annotation
    && !field.derived && !field.constant);
  const bars = barColumns(fields).slice(0, 2);
  const numbers = fields.filter(field => field.kind === 'number');
  const measure = numbers[0] ?? fields.find(temporal);
  const views = bars.map(field => ({ type: 'bar', x: field.name }));
  if (measure) { views.push({ type: 'histogram', x: measure.name }); }
  if (!bars.length && numbers.length > 1) { views.unshift({ type: 'scatter', x: numbers[0].name, y: numbers[1].name }); }
  if (!views.length) { views.push({ type: 'scatter', x: '', y: '' }); }
  return views.map((view, index) => ({ color: '', title: '', ...view, id: `view-${index + 1}` }));
}

// The card the plus button adds: a scatter of the first two measures, else the first default view.
export function newView(model) {
  const numbers = model.fields.filter(field => field.kind === 'number' && !field.identifier && !field.derived);
  if (!numbers.length) { return { ...defaultViews(model)[0] }; }
  return { color: '', title: '', type: 'scatter', x: numbers[0].name, y: numbers[1]?.name ?? '' };
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
