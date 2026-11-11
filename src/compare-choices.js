import { element } from './dom.js';

// Comparisons that are not a column's values: which records to describe, and a hierarchical clustering's branches.
export function populationGroup() {
  return element('optgroup', { label: 'Population' }, [
    new Option('Entire dataset', 'population:all'),
    new Option('Current filtered records', 'population:visible'),
    new Option('Filtered vs remaining table', 'population:filtered'),
  ]);
}

export function treeGroup(model) {
  const trees = model.results.list('clustering').filter(result => result.tree);
  if (!trees.length) { return []; }
  return [element('optgroup', { label: 'Tree branches' }, trees.map(result => new Option(`${result.name} · branches`, `tree:${result.id}`)))];
}
