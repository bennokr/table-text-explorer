import { combineFields, normalize, weightOf } from './word-vectors.js';

export function descriptionEnabled(config) {
  return config.combine === 'description-mean' || Boolean(config.includeDescriptions);
}

export function groupName(field, overrides = {}) {
  return String(overrides[field.name] ?? field.group ?? '').trim() || 'Other fields';
}

function vectorGroups(fields) {
  const groups = new Map();
  fields.forEach((field, index) => {
    const name = groupName(field);
    if (!groups.has(name)) { groups.set(name, { name, indices: [], fields: [] }); }
    groups.get(name).indices.push(index);
    groups.get(name).fields.push(field.name);
  });
  return [...groups.values()];
}

function groupSettings(payload, dimensions) {
  const groups = vectorGroups(payload.fields);
  const identity = payload.groupIdentity ?? 0.2;
  if (!Number.isFinite(identity) || identity < 0 || identity > 1) {
    throw new Error('Preserve group identity must be between 0 and 100%.');
  }
  const blocks = Number(identity < 1) + (identity > 0 ? groups.length : 0);
  return { groups, identity, dimensions: dimensions * blocks };
}

function combineGroups(vectors, weights, settings) {
  const grouped = settings.groups.map(group => combineFields(group.indices.map(index => vectors[index]),
    group.indices.map(index => weights[index]), 'mean'));
  const shared = combineFields(grouped, grouped.map(() => 1), 'mean');
  const separate = combineFields(grouped, grouped.map(() => 1), 'concat');
  if (settings.identity === 0) { return shared; }
  if (settings.identity === 1) { return separate; }
  const result = new Float32Array(shared.length + separate.length);
  result.set(shared.map(value => value * Math.sqrt(1 - settings.identity)));
  result.set(separate.map(value => value * Math.sqrt(settings.identity)), shared.length);
  return normalize(result);
}

function aggregationRecipe(settings) {
  return { method: 'group-mean', identity: settings.identity,
    groups: settings.groups.map(({ name, fields }) => ({ name, fields })),
    weighting: 'Field weights within groups; equal available-group weights across groups',
    missing: 'No vector for empty groups; zero identity blocks. Sparse group availability can affect distances.' };
}

export function sentenceAggregation(payload, dimensions) {
  const weights = payload.fields.map(field => weightOf(payload.weights, field.name));
  if (!weights.every(weight => Number.isFinite(weight) && weight >= 0)) { throw new Error('Field weights must be finite and nonnegative.'); }
  if (payload.combine === 'group-mean') {
    const settings = groupSettings(payload, dimensions);
    return { dimensions: settings.dimensions, recipe: aggregationRecipe(settings),
      combine: vectors => combineGroups(vectors, weights, settings) };
  }
  const method = payload.combine === 'description-mean' ? 'mean' : payload.combine;
  return { dimensions: dimensions * (method === 'concat' ? payload.fields.length : 1), recipe: null,
    combine: vectors => combineFields(vectors, weights, method) };
}
