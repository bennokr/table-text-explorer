import { keyOf } from './schema.js';
import { categoryColor } from './palette.js';

// Colours by value for a categorical column, in order of first appearance: what a map coloured by that column shows.
export function categoryColors(model, field) {
  const keys = [...new Set(model.rows.map(row => keyOf(row[field.name], field)))];
  return new Map(keys.map((key, index) => [key, categoryColor(index)]));
}

// A clustering's own colours, found by cluster name, since a cluster column holds the names.
function clusterNameColors(result) {
  return new Map(Object.values(result.groups).map(group => [group.name, group.color]));
}

// The colour a value of this column has on the map and in the cluster legend.
export function valueColor(model, field) {
  const result = model.results?.get(field.derived);
  if (result?.groups) {
    const colors = clusterNameColors(result);
    return value => colors.get(String(value));
  }
  const colors = categoryColors(model, field);
  return value => colors.get(keyOf(value, field));
}
