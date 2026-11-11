import { $, element, options } from './dom.js';
import { descriptionNodes, treeComparison } from './cluster-tree-descriptions.js';
import { renderTerms } from './term-view.js';
import { Events } from './events.js';
import { treeChoice } from './term-settings-model.js';

// Tree controls show only while a hierarchical clustering's branches are the comparison.
function treeControls(model) {
  const result = model.results.get(treeChoice(model.termSettings));
  const count = result?.groups ? descriptionNodes(result).length : 0;
  $('#terms-tree-node').hidden = !result?.tree;
  $('#terms-tree-comparison').hidden = !result?.tree;
  const branch = result?.descriptionNode;
  options($('#terms-tree-node'), [['', 'Active clusters'],
    ...(branch === undefined ? [] : [[String(branch), result.groups[branch].name]])], branch === undefined ? '' : String(branch));
  const pages = Array.from({ length: Math.max(1, Math.ceil(count / 20)) }, (_, page) =>
    [String(page), `Groups ${page * 20 + 1}–${Math.min(count, (page + 1) * 20)}`]);
  options($('#terms-group-page'), pages, String(model.termSettings.groupPage));
  $('#terms-group-page').hidden = count <= 20;
}

export function bindTreeControls(model, describe) {
  $('#terms-tree-node').oninput = event => {
    const result = model.results.get(treeChoice(model.termSettings));
    if (event.target.value === '') { delete result.descriptionNode; }
    treeControls(model);
    describe();
  };
  for (const type of [Events.TERM_SETTINGS, Events.RESULTS, Events.DATA]) { model.on(type, () => treeControls(model)); }
  treeControls(model);
}

// A tree's branches, each against its siblings or the rest of the visible records. (A flat clustering is
// a column: Compare by its name column.)
export function clusterComparison(model, resultId, page = 0, mode = 'siblings') {
  const result = model.results.get(resultId);
  if (result?.kind !== 'clustering' || !result.tree) { return null; }
  const groups = descriptionNodes(result).slice(page * 20, (page + 1) * 20)
    .map(id => treeComparison(model, result, id, mode)).filter(group => group.subset.length);
  return { subset: model.visible, comparison: [], groups };
}

export function renderGroups(container, groups, model, activate, views) {
  for (const node of container.querySelectorAll('.term-cloud')) { node.dispose(); }
  const expanded = new Map([...container.querySelectorAll('details[data-group-id]')].map(node => [node.dataset.groupId, node.open]));
  container.replaceChildren(...groups.map(group => {
    const content = element('div');
    renderTerms(content, group.description, model, activate, views);
    return element('details', { 'data-group-id': group.id, ...(expanded.get(group.id) !== false ? { open: '' } : {}) }, [element('summary', {
      text: `${group.name} · ${group.description.subset} vs ${group.description.comparison} ${group.comparisonLabel ?? 'other visible records'}` }), content]);
  }));
}

export function groupDescriptionStatus(groups) {
  if (new Set(groups.map(group => group.comparisonLabel)).size > 1) {
    return `${groups.length} groups · branches vs siblings; Other vs remaining visible records`;
  }
  const comparison = groups[0]?.comparisonLabel ?? 'the rest of visible records';
  return `${groups.length} groups · each compared with ${comparison}`;
}
