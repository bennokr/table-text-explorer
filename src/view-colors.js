// Immediate neighbors in the authoritative card order form a map/legend pair.
// A legend to the right wins ties. Pairing follows reordering and result changes.
export function synchronizeViewColors(model) {
  model.views.forEach((view, index) => {
    if (view.type !== 'map') { return; }
    const neighbor = [model.views[index + 1], model.views[index - 1]]
      .find(candidate => candidate?.type === 'legend' && model.resultFor(candidate)?.columns);
    if (neighbor) {
      view.legendId = neighbor.id;
      view.color = model.resultFor(neighbor).columns.name;
    } else { delete view.legendId; }
  });
}
