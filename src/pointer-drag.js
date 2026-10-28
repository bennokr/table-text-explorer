// A gesture commits on release; Escape, cancellation and lost capture restore it.
export function pointerDrag(node, start) {
  let gesture;
  const escape = event => {
    if (event.key === 'Escape' && gesture) { event.preventDefault(); finish(true); }
  };
  const finish = cancel => {
    const active = gesture;
    gesture = null;
    document.removeEventListener('keydown', escape, true);
    active?.end(cancel);
  };
  node.onpointerdown = event => {
    if (event.button !== 0) { return; }
    event.preventDefault();
    gesture = start(event);
    node.setPointerCapture(event.pointerId);
    document.addEventListener('keydown', escape, true);
  };
  node.onpointermove = event => gesture?.move(event);
  node.onpointerup = event => {
    finish(false);
    node.releasePointerCapture(event.pointerId);
  };
  node.onpointercancel = () => finish(true);
  node.onlostpointercapture = () => finish(true);
}
