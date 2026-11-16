import { branchChildren, treeRoot, treeRows, treeMembers, colorTreeBranch } from './cluster-tree.js';

export function legendRows(model, result) {
  if (result.tree) { return treeRows(model, result); }
  const visible = new Set(model.visible);
  const groups = new Map(Object.entries(result.groups).map(([id, group]) => [id,
    { id, ...group, ids: [], total: 0, highlighted: 0 }]));
  result.rowIds.forEach((row, index) => {
    const group = groups.get(String(result.labels[index]));
    group.total += 1;
    if (!visible.has(row)) { return; }
    group.ids.push(row);
    if (model.selected.has(row)) { group.highlighted += 1; }
  });
  const rows = [...groups.values()];
  const maximum = Math.max(1, ...rows.map(group => group.ids.length));
  return rows.map(group => ({ ...group, count: group.ids.length, width: 100 * group.ids.length / maximum }));
}

export function renameCluster(model, result, id, value) {
  const name = value.trim() || (String(id) === '-1' ? 'Other' : `#${Number(id) + 1}`);
  result.groups[id].nameEdited = Boolean(value.trim());
  delete result.groups[id].nameEvidence;
  if (result.groups[id].name !== name) {
    result.groups[id].name = name;
    model.resultsChanged();
  }
  return name;
}

export function colorCluster(model, result, id, value) {
  if (result.groups[id].color === value) { return; }
  if (result.tree) { colorTreeBranch(result, id, value); }
  else { result.groups[id].color = value; }
  model.resultsChanged({ valuesChanged: false });
}

export function clusterMembers(model, result, id) {
  if (!result.tree) { return legendRows(model, result).find(group => group.id === id).ids; }
  const visible = new Set(model.visible);
  return treeMembers(result, id).filter(row => visible.has(row));
}

// The names of a clustering's groups in the order its legend card lists them, so other lists of the
// same clusters (the color key above the phrase cloud) can follow it.
export function legendNames(result) {
  if (!result.tree) { return Object.values(result.groups).map(group => group.name); }
  const names = [];
  const visit = id => {
    names.push(result.groups[id]?.name);
    for (const child of branchChildren(result, id)) { visit(child); }
  };
  visit(treeRoot(result));
  if (result.tree.kind === 'density') { names.push(result.groups[-1]?.name); }
  return names;
}
