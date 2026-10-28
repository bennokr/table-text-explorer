import { treeMembers, treeParents } from './cluster-tree.js';

export function descriptionNodes(result) {
  if (!result.tree) { return Object.keys(result.groups); }
  if (result.descriptionNode !== undefined) { return [String(result.descriptionNode)]; }
  return [...result.cut, ...(result.tree.kind === 'density' ? [-1] : [])].map(String);
}

export function treeComparison(model, result, id, mode) {
  const visible = new Set(model.visible);
  const subset = treeMembers(result, id).filter(row => visible.has(row));
  const members = new Set(subset);
  let candidates = model.visible;
  if (mode === 'siblings' && Number(id) !== -1) {
    const parent = treeParents(result)[Number(id)];
    candidates = parent === undefined ? [] : treeMembers(result, parent);
  }
  return { id: String(id), name: result.groups[id].name, subset,
    comparisonLabel: mode === 'siblings' && Number(id) !== -1 ? 'sibling records' : 'other visible records',
    comparison: candidates.filter(row => visible.has(row) && !members.has(row)) };
}
