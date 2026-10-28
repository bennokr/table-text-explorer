import { element, options } from './dom.js';

export function mountNameLength(parent, maximum = 4) {
  const select = element('select', { class: 'name-length', 'aria-label': 'Maximum phrases per cluster name' });
  options(select, [1, 2, 3, 4, 5].map(count => [String(count), String(count)]), String(maximum));
  parent.append(element('label', {}, ['Max phrases ', select]));
  return select;
}

export function nameLength(select) { return Number(select.value); }
