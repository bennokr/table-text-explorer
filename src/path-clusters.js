// A condition on a cluster column ("kmeans-k10 · name = onderwijs · kinderen") need not be spelled out when the
// cluster legend is on screen: its color and first phrase say which row of the legend it is.
export function clusterCondition(model, node) {
  const inner = node.kind === 'not' ? node.child : node;
  if (inner.kind !== 'term' || inner.op !== '=') { return null; }
  const field = model.fields.find(candidate => candidate.name === inner.field);
  const result = model.results.get(field?.derived);
  const entry = Object.entries(result?.groups ?? {}).find(([, group]) => group.name === inner.value);
  if (!entry) { return null; }
  const [id, group] = entry;
  const shown = model.views.some(view => view.type === 'legend' && view.resultId === result.id);
  return { id, color: group.color, name: group.name, negated: node.kind === 'not', shown };
}

// Lights up (or not) a cluster's row in the legend card, so a chip or a value can be matched with it.
export function pulseLegendRow(id, on) {
  document.querySelector(`.cluster-legend [data-cluster-id="${id}"]`)?.classList.toggle('pulse', on);
}

export function scrollToLegendRow(id) {
  document.querySelector(`.cluster-legend [data-cluster-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
}

// The text of such a chip: the first phrase of the name when the legend shows the whole name, else the whole
// name without the long column name. The dot's color does the rest.
export function clusterChipLabel(condition) {
  const text = condition.shown ? condition.name.split(' · ')[0] : condition.name;
  return condition.negated ? `NOT ${text}` : text;
}

// The text of a chip for a condition on a cluster column or for one of its values: the first phrase when the legend
// shows the whole name, else the name itself. Anything that is not a cluster keeps `fallback`.
export function conditionText(model, condition, fallback) {
  const cluster = clusterCondition(model, condition);
  return cluster ? clusterChipLabel(cluster) : fallback;
}

// Hovering a cluster's chip lights up its row in the legend card (nothing for other chips).
export function legendHover(cluster) {
  if (!cluster?.shown) { return {}; }
  return { onmouseenter: () => pulseLegendRow(cluster.id, true), onmouseleave: () => pulseLegendRow(cluster.id, false) };
}
