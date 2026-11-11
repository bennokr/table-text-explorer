// Combined presentation keeps every (field, phrase) predicate independent.
const fieldColors = ['#3979a5', '#b65b16', '#548039', '#9154a0', '#bd4657', '#267f80', '#856817', '#6659ae'];
export const populationRankings = new Set(['frequency', 'balanced', 'semantic']);

export function fieldColor(index) {
  return fieldColors[index] ?? `hsl(${Math.round(index * 137.508) % 360}, 55%, 35%)`;
}

export function displayFields(fields, combined) {
  if (!combined || !fields.length) { return fields; }
  return [{ name: 'Selected fields', combined: true, fields,
    vocabulary: fields.reduce((sum, field) => sum + field.vocabulary, 0),
    representatives: [], terms: fields.flatMap((field, index) => field.terms.map(term => ({
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
  return `${population}: contains ${containing}/${total} (${percent}%) · Does not contain: ${total - containing} (${100 - percent}%)${gain}`;
}
