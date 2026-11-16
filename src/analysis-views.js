function card(model, config) {
  return { color: '', title: '', x: '', y: '', ...config, id: model.nextViewId() };
}

export function showMap(model, result, targetViewId) {
  const target = model.views.find(view => view.id === targetViewId && view.type === 'map' && !view.resultId);
  if (target) { target.resultId = result.id; return target; }
  const view = card(model, { type: 'map', resultId: result.id });
  model.views.unshift(view);
  return view;
}

function relatedMap(map, clustering) {
  if (!map) { return false; }
  if (clustering.inputMapId) { return map.id === clustering.inputMapId; }
  return Boolean(clustering.sourceId && map.representationId === clustering.sourceId) || Boolean(clustering.featureSetId && map.featureSetId === clustering.featureSetId);
}

export function showClustering(model, result) {
  const maps = model.views.filter(view => view.type === 'map');
  for (const view of maps) {
    if (relatedMap(model.resultFor(view), result)) { view.color = result.columns.name; }
  }
  const view = card(model, { type: 'legend', resultId: result.id });
  // The legend goes right after its map, so the color key sits next to what it colors.
  const map = maps.find(candidate => relatedMap(model.resultFor(candidate), result)) ?? maps[0];
  if (map) { model.views.splice(model.views.indexOf(map) + 1, 0, view); } else { model.views.push(view); }
  return view;
}
