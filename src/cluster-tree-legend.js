import { showTermSettings } from './term-settings.js';
import { mountDensityControls } from './density-controls.js';
import { element, $ } from './dom.js';
import { changeTreeCut, branchChildren, treeParents, treeRoot } from './cluster-tree.js';
import { Events } from './events.js';
import { setTermSettings } from './term-settings-model.js';

function initialExpansion(result) {
  const parents = treeParents(result), opened = new Set();
  for (const id of result.cut) {
    let parent = parents[id];
    while (parent !== undefined && !opened.has(parent)) {
      opened.add(parent);
      parent = parents[parent];
    }
  }
  return opened;
}

function appendBranch(legend, id, parent, groups, opened) {
  const children = branchChildren(legend.result, id);
  if (!children.length) { legend.add(groups[id], parent); return; }
  const summary = element('summary');
  legend.add(groups[id], summary);
  const nested = element('div', { class: 'cluster-children' });
  const branch = element('details', { class: 'cluster-branch', 'data-tree-node': id }, [summary, nested]);
  branch.ontoggle = () => {
    if (!branch.open || nested.childElementCount) { return; }
    for (const child of children) { appendBranch(legend, child, nested, groups, opened); }
    legend.paint();
  };
  parent.append(branch);
  branch.open = opened.has(Number(id));
}

export function mountTreeLegend(legend) {
  const result = legend.result;
  if (result.tree.kind === 'density') { mountDensityControls(legend); }
  else { mountCountControl(legend); }
  const groups = Object.fromEntries(legend.groupRows().map(group => [group.id, group]));
  legend.openedTree = initialExpansion(result);
  appendBranch(legend, treeRoot(result), legend.root, groups, legend.openedTree);
  if (result.tree.kind === 'density') { legend.add(groups[-1]); }
}

export function describeBranch(model, result, id) {
  result.descriptionNode = Number(id);
  model.emit(Events.RESULTS);
  setTermSettings(model, { compare: `tree:${result.id}`, groupPage: 0 });
  showTermSettings(true);
  $('#description-panel').scrollIntoView({ block: 'nearest' });
}

export function revealTreeCut(legend) {
  const key = legend.result.cut.join(',');
  if (legend.cutKey === key) { return; }
  legend.cutKey = key;
  legend.openedTree.clear();
  for (const id of initialExpansion(legend.result)) { legend.openedTree.add(id); }
  for (const branch of legend.root.querySelectorAll('details[data-tree-node]')) {
    if (legend.openedTree.has(Number(branch.dataset.treeNode))) { branch.open = true; }
  }
}

function mountCountControl(legend) {
  const result = legend.result;
  legend.cutCount = element('input', { type: 'number', min: '1', max: result.rowIds.length,
    value: result.cut.length, 'aria-label': 'Number of clusters in tree cut' });
  legend.cutCount.onchange = () => {
    changeTreeCut(legend.model, result, legend.cutCount.value);
    legend.cutCount.value = result.cut.length;
  };
  legend.root.append(element('label', { class: 'cluster-cut',
    title: 'Reuse the fitted tree. Changes map colors and exported memberships without refitting.' }, [
    'Clusters ', legend.cutCount]));
}
