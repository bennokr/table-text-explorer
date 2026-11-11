// A condition on a cluster column ("kmeans-k10 · name = onderwijs · kinderen") need not be spelled out when the
// cluster legend is on screen: its colour and number say which row of the legend it is.
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

// The text of such a chip: the number when the legend shows the name, else the name without the long column name.
export function clusterChipLabel(condition) {
  const text = condition.shown ? `#${Number(condition.id) + 1}` : condition.name;
  return condition.negated ? `NOT ${text}` : text;
}
