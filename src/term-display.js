import { categoryColor } from './palette.js';
// Combined presentation keeps every (field, phrase) predicate independent.
export const populationRankings = new Set(['frequency', 'balanced', 'semantic']);

export function fieldColor(index) {
  return categoryColor(index);
}

export function displayFields(fields, combined) {
  if (!combined || !fields.length) { return fields; }
  return [{ name: 'Selected fields', combined: true, fields,
    vocabulary: fields.reduce((sum, field) => sum + field.vocabulary, 0),
    terms: fields.flatMap((field, index) => field.terms.map(term => ({
      ...term, field: field.name, color: fieldColor(index),
    }))) }];
}

export function populationTooltip(term, ranking) {
  const containing = term.partitionSupport;
  const total = term.population;
  const percent = total ? Math.round(100 * containing / total) : 0;
  const left = ranking === 'balanced' ? ` · Yes leaves ${containing}, no leaves ${total - containing}` : '';
  const gain = ranking === 'semantic' ? ` · Semantic gain: ${(100 * term.semantic).toPrecision(3)}%` : left;
  const population = term.kind === 'facet' ? 'Among scored records, including missing values' : 'Among scored records with usable field text';
  const where = term.region ? ` · ${Math.round(100 * term.regionShare)}% of these records are in ${term.region}` : '';
  return `${population}: contains ${containing}/${total} (${percent}%) · Does not contain: ${total - containing} (${100 - percent}%)${gain}${where}`;
}
