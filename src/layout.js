import { $ } from './dom.js';

function divider(node, axis) {
  const workspace = $('.workspace');
  const horizontal = axis === 'x';
  const property = horizontal ? '--left' : '--top';
  let value = horizontal ? 62 : 57;
  const update = next => {
    value = Math.max(30, Math.min(75, next));
    workspace.style.setProperty(property, `${value}fr`);
    workspace.style.setProperty(horizontal ? '--right' : '--bottom', `${100 - value}fr`);
    node.setAttribute('aria-valuenow', String(Math.round(value)));
  };
  node.onpointerdown = event => {
    event.preventDefault();
    node.setPointerCapture(event.pointerId);
  };
  node.onpointermove = event => {
    if (!node.hasPointerCapture(event.pointerId)) { return; }
    const bounds = workspace.getBoundingClientRect();
    const position = horizontal ? event.clientX - bounds.left : event.clientY - bounds.top;
    update(100 * position / (horizontal ? bounds.width : bounds.height));
  };
  node.onpointerup = event => node.releasePointerCapture(event.pointerId);
  node.onkeydown = event => {
    const keys = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) { return; }
    event.preventDefault();
    update(value + (event.key === keys[0] ? -2 : 2));
  };
  node.ondblclick = () => update(horizontal ? 62 : 57);
}

export function layout() {
  divider($('#column-divider'), 'x');
  divider($('#row-divider'), 'y');
}
