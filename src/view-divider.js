import { element } from './dom.js';
import { pointerDrag } from './pointer-drag.js';

// Capture stays on a stable node while the layout changes around it.
export function viewDivider(axis, start, reset) {
  const vertical = axis === 'x';
  const node = element('div', { class: `divider view-divider ${vertical ? 'vertical' : 'horizontal'}`,
    role: 'separator', tabindex: '0', 'aria-orientation': vertical ? 'vertical' : 'horizontal',
    'aria-label': vertical ? 'Resize cards' : 'Resize rows',
    title: 'Drag to resize; double-click to reset. Arrow keys resize.' });
  node.begin = start;
  pointerDrag(node, event => {
    const origin = vertical ? event.clientX : event.clientY;
    const change = node.begin();
    return {
      move: next => change((vertical ? next.clientX : next.clientY) - origin),
      end: cancel => change.finish?.(cancel),
    };
  });
  node.onkeydown = event => {
    const keys = vertical ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) { return; }
    event.preventDefault();
    const change = node.begin();
    change(event.key === keys[0] ? -20 : 20);
    change.finish?.(false);
  };
  node.reset = reset;
  node.ondblclick = () => node.reset();
  return node;
}
