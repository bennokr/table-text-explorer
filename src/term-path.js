import { $, element } from './dom.js';
import { chipLabel, conjuncts } from './query-path.js';
import { clusterChipLabel, clusterCondition } from './path-clusters.js';

// The path bar shows the conditions behind the highlight, one chip per click. The search box stays the
// source of truth; removing a chip asks the search to rewrite its text without that condition.
export function bindPath(model) {
  // Hovering or clicking a cluster chip lights up its row in the legend.
  const legendRow = id => document.querySelector(`.cluster-legend [data-cluster-id="${id}"]`);
  const pulse = (id, on) => legendRow(id)?.classList.toggle('pulse', on);
  const body = node => {
    const cluster = clusterCondition(model, node);
    const full = chipLabel(node);
    if (!cluster) { return { label: full, parts: [element('span', { text: full })] }; }
    const dot = element('span', { class: 'chip-dot', style: `background: ${cluster.color}` });
    return { label: full, parts: [dot, element('span', { text: clusterChipLabel(cluster), title: full })],
      events: { onmouseenter: () => pulse(cluster.id, true), onmouseleave: () => pulse(cluster.id, false),
        onclick: () => { legendRow(cluster.id)?.scrollIntoView({ block: 'nearest' }); } } };
  };
  const chip = (node, index) => {
    const { label, parts, events } = body(node);
    const remove = element('button', { type: 'button', text: '×', 'aria-label': `Remove condition ${label}`, title: 'Remove this condition',
      onclick: () => { model.pathRemoval = index; model.emit('description-remove'); } });
    return element('span', { class: 'path-chip', title: label, ...events }, [...parts, remove]);
  };
  const render = () => {
    const path = conjuncts(model.ast);
    const bar = $('#terms-path');
    bar.hidden = !path.length;
    const left = model.visible.filter(id => model.selected.has(id)).length;
    bar.replaceChildren(element('span', { class: 'path-label', text: 'Path' }), ...path.map(chip),
      element('small', { text: `${left.toLocaleString()} of ${model.visible.length.toLocaleString()} records left` }));
  };
  for (const type of ['selection', 'data', 'schema']) { model.on(type, render); }
  render();
}
