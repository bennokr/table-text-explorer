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
  for (const view of model.views.filter(view => view.type === 'map')) {
    if (relatedMap(model.resultFor(view), result)) { view.color = result.columns.name; }
  }
  const view = card(model, { type: 'legend', resultId: result.id });
  model.views.push(view);
  return view;
}
