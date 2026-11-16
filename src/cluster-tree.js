import { OTHER } from './palette.js';
// Tree node IDs are stable within a fitted result: leaves first, then branches.
export function treeRoot(result) { return result.rowIds.length + result.tree.children.length - 1; }

export function branchChildren(result, id) {
  const children = treeChildren(result, id);
  if (result.tree.kind !== 'density') { return children; }
  return children.filter(child => child >= result.rowIds.length);
}
export function treeChildren(result, id) {
  return result.tree.children[Number(id) - result.rowIds.length] ?? [];
}

export function treeMembers(result, id) {
  if (Number(id) === -1) { return result.rowIds.filter((_, index) => result.labels[index] === -1); }
  const pending = [Number(id)], rows = [];
  while (pending.length) {
    const node = pending.pop();
    const children = treeChildren(result, node);
    if (children.length) { for (const child of children) { pending.push(child); } }
    else { rows.push(result.rowIds[node]); }
  }
  return rows;
}

export function treeParents(result) {
  const parents = [];
  result.tree.children.forEach((children, index) => {
    for (const child of children) { parents[child] = result.rowIds.length + index; }
  });
  return parents;
}

function cutTree(result, count) {
  const active = new Set([result.rowIds.length * 2 - 2]);
  for (let node = result.rowIds.length * 2 - 2; active.size < count; node -= 1) {
    if (!active.delete(node)) { continue; }
    for (const child of treeChildren(result, node)) { active.add(child); }
  }
  result.cut = [...active].sort((a, b) => a - b);
  const positions = new Map(result.rowIds.map((row, index) => [row, index]));
  result.labels = Array(result.rowIds.length);
  for (const id of result.cut) {
    for (const row of treeMembers(result, id)) { result.labels[positions.get(row)] = id; }
  }
}

function hueColor(hue, lightness) {
  const saturation = 0.57;
  const amplitude = saturation * Math.min(lightness, 1 - lightness);
  const channel = offset => {
    const position = (offset + hue / 30) % 12;
    const value = lightness - amplitude * Math.max(-1, Math.min(position - 3, 9 - position, 1));
    return Math.round(value * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

export function initializeTree(result) {
  if (!result.tree) { return; }
  const root = treeRoot(result);
  result.groups = {};
  const pending = [{ id: root, hue: 220, span: 300, depth: 0 }];
  while (pending.length) {
    const { id, hue, span, depth } = pending.pop();
    result.groups[id] = { name: id === root ? 'All records' : `#${id + 1}`,
      color: hueColor(hue, 0.43 + Math.min(depth, 6) * 0.025) };
    branchChildren(result, id).forEach((child, index) => {
      pending.push({ id: child, hue: (hue + (index ? 1 : -1) * span / 4 + 360) % 360,
        span: span / 2, depth: depth + 1 });
    });
  }
  if (result.tree.kind === 'density') {
    result.groups[-1] = { name: 'Other', color: OTHER };
    result.selection = { method: 'eom', epsilon: 0 };
  } else { cutTree(result, result.parameters.clusters); }
}

export function treeRows(model, result) {
  const visible = new Set(model.visible);
  const rows = Array.from({ length: treeRoot(result) + 1 }, (_, node) => ({ id: String(node),
    ...result.groups[node], total: 0, count: 0, highlighted: 0 }));
  result.rowIds.forEach((row, index) => {
    rows[index].total = 1;
    rows[index].count = Number(visible.has(row));
    rows[index].highlighted = Number(visible.has(row) && model.selected.has(row));
  });
  result.tree.children.forEach((children, index) => {
    const parent = rows[result.rowIds.length + index];
    for (const child of children) {
      for (const key of ['total', 'count', 'highlighted']) { parent[key] += rows[child][key]; }
    }
  });
  const maximum = Math.max(1, rows.at(-1).count);
  if (result.tree.kind === 'density') { rows.push(noiseRow(model, result, visible)); }
  return rows.filter(row => result.groups[row.id]).map(row => ({ ...row, width: 100 * row.count / maximum }));
}

export function changeTreeCut(model, result, count) {
  if (result.tree.kind === 'density') { return false; }
  const value = Number(count);
  if (!Number.isInteger(value) || value < 1 || value > result.rowIds.length) { return false; }
  cutTree(result, value);
  model.resultsChanged();
  return true;
}

function shade(color, tone) {
  const channels = color.slice(1).match(/../g).map(value => parseInt(value, 16));
  return '#' + channels.map(value => {
    const target = tone > 0 ? 255 : 0;
    return Math.round(value + (target - value) * Math.abs(tone)).toString(16).padStart(2, '0');
  }).join('');
}

export function colorTreeBranch(result, id, color) {
  const pending = [{ id: Number(id), tone: 0, span: 0.18 }];
  while (pending.length) {
    const node = pending.pop();
    result.groups[node.id].color = shade(color, node.tone);
    branchChildren(result, node.id).forEach((child, index) => {
      if (result.groups[child].colorEdited) { return; }
      pending.push({ id: child, tone: node.tone + (index ? 1 : -1) * node.span, span: node.span / 2 });
    });
  }
  result.groups[id].colorEdited = true;
}

function noiseRow(model, result, visible) {
  const ids = treeMembers(result, -1);
  const present = ids.filter(id => visible.has(id));
  return { id: '-1', ...result.groups[-1], total: ids.length, count: present.length,
    highlighted: present.filter(id => model.selected.has(id)).length };
}
