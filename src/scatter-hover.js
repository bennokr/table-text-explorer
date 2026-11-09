import { categoryLabel, missing } from './schema.js';
import { featureFields } from './features.js';

function hoverFields(model, coordinates) {
  if (!coordinates.fitted) {
    return [coordinates.x.field, coordinates.y.field].filter(Boolean);
  }
  const fitted = { fields: model.fields, config: coordinates.config };
  if (fitted.config.mode !== 'table') { return featureFields(fitted); }
  const text = model.fields.filter(field => field.kind === 'text' && !field.identifier && !field.annotation);
  return text.length ? text : featureFields(fitted);
}

function escapeHover(value) {
  const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/gu, character => entities[character]);
}

function recordHover(row, fields, limit) {
  const present = fields.filter(field => !missing(row[field.name], field)).slice(0, limit);
  return present.map(field => `<div><strong>${escapeHover(field.name)}:</strong> ${escapeHover(categoryLabel(row[field.name], field))}</div>`).join('');
}

export function hoverData(model, coordinates) {
  const fields = [...new Map(hoverFields(model, coordinates).map(field => [field.name, field])).values()];
  const limit = coordinates.fitted && coordinates.config.mode === 'table' ? 3 : fields.length;
  return {
    tooltips: '<div style="max-width:min(420px,55vw);white-space:pre-wrap;overflow-wrap:anywhere">@hover{safe}</div>',
    data: { hover: model.rows.map(row => recordHover(row, fields, limit)) },
  };
}
