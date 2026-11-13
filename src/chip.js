import { element } from './dom.js';

// One chip: an optional color dot, then a label. The conditions in the search field, the color key under a map or
// scatter card and the chips above a phrase cloud are all this component; they differ only in what a click does.
// With `remove` the chip is a plain tag with a × button (a condition that can be taken away); without it the whole
// chip is a button. `events` are extra listeners (hovering a cluster's chip lights its legend row).
export function chip({ color, label, title, className = '', events = {}, onclick, remove }) {
  const parts = [...(color ? [element('span', { class: 'chip-dot', style: `background: ${color}` })] : []), element('span', { text: label })];
  if (!remove) { return element('button', { type: 'button', class: `chip ${className}`, title, ...events, onclick }, parts); }
  const button = element('button', { type: 'button', text: '×', 'aria-label': remove.label, title: 'Remove this condition', onclick: remove.onclick });
  return element('span', { class: `chip ${className}`, title, ...events }, [...parts, button]);
}
