import { $, element, options } from './dom.js';
import { descriptionNodes, treeComparison } from './cluster-tree-descriptions.js';
import { renderTerms } from './term-view.js';

function groupPages(model) {
  const result = model.results.get($('#terms-scope').value);
  const count = result?.groups ? descriptionNodes(result).length : 0;
  $('#terms-tree-node').hidden = !result?.tree;
  $('#terms-tree-comparison').hidden = !result?.tree;
  const branch = result?.descriptionNode;
  options($('#terms-tree-node'), [['', 'Active clusters'],
    ...(branch === undefined ? [] : [[String(branch), result.groups[branch].name]])], branch === undefined ? '' : String(branch));
  const pages = Array.from({ length: Math.max(1, Math.ceil(count / 20)) }, (_, page) =>
    [String(page), `Groups ${page * 20 + 1}–${Math.min(count, (page + 1) * 20)}`]);
  options($('#terms-group-page'), pages, $('#terms-group-page').value);
  $('#terms-group-page').hidden = count <= 20;
}

export function clusterScopes(model, describe) {
  const update = () => {
    const select = $('#terms-scope');
    options(select, [['selection', 'Highlighted / current records'], ['all', 'Entire dataset'], ['visible', 'Current filtered records'], ['filtered', 'Filtered vs remaining table'],
      ...model.results.list('clustering').map(result => [result.id, `${result.name} · ${result.tree ? 'tree branches' : 'groups vs rest of visible'}`])], select.value);
    groupPages(model);
    describe();
  };
  $('#terms-scope').addEventListener('input', () => groupPages(model));
  $('#terms-group-page').oninput = () => describe();
  $('#terms-tree-node').oninput = event => {
    const result = model.results.get($('#terms-scope').value);
    if (event.target.value === '') { delete result.descriptionNode; }
    groupPages(model);
    describe();
  };
  model.on('results', update);
  model.on('data', update);
}

export function clusterComparison(model, scope, page = 0, mode = 'siblings') {
  const result = model.results.get(scope);
  if (result?.kind !== 'clustering') { return null; }
  if (result.tree) {
    const groups = descriptionNodes(result).slice(page * 20, (page + 1) * 20)
      .map(id => treeComparison(model, result, id, mode)).filter(group => group.subset.length);
    return { subset: model.visible, comparison: [], groups };
  }
  const membership = new Map(result.rowIds.map((id, index) => [id, result.labels[index]]));
  const groups = Object.entries(result.groups).slice(page * 20, (page + 1) * 20).map(([id, group]) => ({
    id, name: group.name, subset: model.visible.filter(row => String(membership.get(row)) === id),
    comparison: model.visible.filter(row => String(membership.get(row)) !== id),
  })).filter(group => group.subset.length);
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
