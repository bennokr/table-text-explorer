// Shift adds and Alt intersects. Aggregate glyphs need the
// same operations on record IDs, since a highlighted bin may only be partial.
export function combineSelection(previous, ids, mode) {
  if (mode === 'add') { return [...new Set([...previous, ...ids])]; }
  const matches = new Set(ids);
  if (mode === 'intersect') { return [...previous].filter(id => matches.has(id)); }
  if (mode === 'subtract') { return [...previous].filter(id => !matches.has(id)); }
  return ids;
}

function brushMode(event) {
  if (event.shiftKey) { return 'add'; }
  if (event.altKey) { return 'intersect'; }
  return 'replace';
}

export function aggregateBrush(container, model, source, renderer) {
  let gesture;
  const start = event => {
    gesture = { previous: new Set(model.selected), mode: brushMode(event) };
    // Seed Bokeh so its modifier operation produces only the hit groups.
    renderer.updating = true;
    source.selected.indices = gesture.mode === 'intersect' ? renderer.groups.members.map((_, index) => index) : [];
    renderer.updating = false;
  };
  const change = () => {
    if (renderer.updating) { return; }
    const visible = new Set(model.visible);
    const indices = source.selected.indices;
    const ids = indices.flatMap(index => renderer.groups.members[index]).filter(id => visible.has(id));
    if (gesture) { model.select(combineSelection(gesture.previous, ids, gesture.mode)); }
    else { model.select(ids); }
  };
  container.addEventListener('pointerdown', start, true);
  source.selected.properties.indices.change.connect(change);
  return () => {
    container.removeEventListener('pointerdown', start, true);
    source.selected.properties.indices.change.disconnect(change);
  };
}
