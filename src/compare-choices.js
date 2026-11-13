import { element } from './dom.js';

// A hierarchical clustering's branches, each compared with its siblings or the rest of the visible records.
export function treeGroup(model) {
  const trees = model.results.list('clustering').filter(result => result.tree);
  if (!trees.length) { return []; }
  return [element('optgroup', { label: 'Tree branches' }, trees.map(result => new Option(`${result.name} · branches`, `tree:${result.id}`)))];
}
