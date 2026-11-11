import { categorical, missing } from './schema.js';
import { OTHER as SPREAD } from './palette.js';
import { valueColor } from './value-colors.js';

const MIN_SHARE = 0.35; // Below this a phrase's records are spread over several regions.

// The column the first map is coloured by, when it is a category (a clustering, say).
export function mapColumn(model) {
  const name = model.views.find(view => view.type === 'map')?.color;
  const field = model.fields.find(candidate => candidate.name === name);
  return field && categorical(field) ? field : null;
}

function regionOf(model, field, ids) {
  const counts = new Map();
  let total = 0;
  for (const id of ids) {
    const value = model.rows[id][field.name];
    if (missing(value, field)) { continue; }
    counts.set(value, (counts.get(value) ?? 0) + 1);
    total += 1;
  }
  const [value, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { value, share: total ? count / total : 0 };
}

// Colours each phrase by the region of the map where most of its records are, in the map's own colours,
// so a semantic split can be read against the clusters. Phrases spread over several regions are grey.
export function tintByRegion(model, result) {
  const field = mapColumn(model);
  if (!field) { return result; }
  const colorOf = valueColor(model, field);
  const tint = term => {
    const { value, share } = regionOf(model, field, term.ids ?? []);
    const focused = value !== null && share >= MIN_SHARE;
    return { ...term, color: focused ? colorOf(value) ?? SPREAD : SPREAD, region: focused ? String(value) : null,
      regionShare: share };
  };
  return { ...result, tinted: field.name, fields: result.fields.map(item => ({ ...item, terms: item.terms.map(tint) })) };
}
