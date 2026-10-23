import { display } from './dom.js';
import { categoryLabel } from './schema.js';
import { featureFields } from './features.js';

export function hoverFields(model, coordinates) {
  if (!coordinates.fitted) {
    return [coordinates.x.field, coordinates.y.field].filter(Boolean);
  }
  const fitted = { fields: model.fields, config: coordinates.config };
  if (fitted.config.mode !== 'table') { return featureFields(fitted); }
  const text = model.fields.filter(field => field.kind === 'text' && !field.identifier && !field.annotation);
  return text.length ? text.slice(0, 3) : featureFields(fitted).slice(0, 3);
}

export function hoverData(model, coordinates) {
  const fields = [...new Map(hoverFields(model, coordinates).map(field => [field.name, field])).values()];
  return {
    tooltips: fields.map((field, index) => [field.name,
      `<div style="max-width:min(420px,55vw);white-space:pre-wrap;overflow-wrap:anywhere">@hover_${index}</div>`]),
    data: Object.fromEntries(fields.map((field, index) => [`hover_${index}`,
      model.rows.map(row => display(categoryLabel(row[field.name], field)))])),
  };
}
