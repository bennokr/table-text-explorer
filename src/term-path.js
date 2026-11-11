import { $, element } from './dom.js';
import { chipLabel, conjuncts } from './query-path.js';

// The path bar shows the conditions behind the highlight, one chip per click. The search box stays the
// source of truth; removing a chip asks the search to rewrite its text without that condition.
export function bindPath(model) {
  const chip = (node, index) => {
    const label = chipLabel(node);
    const remove = element('button', { type: 'button', text: '×', 'aria-label': `Remove condition ${label}`, title: 'Remove this condition',
      onclick: () => { model.pathRemoval = index; model.emit('description-remove'); } });
    return element('span', { class: 'path-chip' }, [element('span', { text: label }), remove]);
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
