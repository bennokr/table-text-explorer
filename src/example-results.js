import { clusterColumns, clusterGroups } from './results.js';
import { showClustering, showMap } from './analysis-views.js';
import { Events } from './events.js';

// A curated example can ship a similarity map and a clustering (`results.json` beside its demo.json): coordinates
// and labels in table order, with hand-edited cluster names. They become saved results like any others, marked as
// precomputed, so the map and its legend are on screen as soon as the example opens. Nothing is fitted here, and
// fitting again stays an explicit choice. A file for another table (a different record count) is ignored.
const aligned = (values, records) => values?.length === records;

export function usableResults(data, records) {
  if (data?.version !== 1 || data.records !== records) { return false; }
  return [data.map?.x, data.map?.y, data.clustering?.labels].every(values => aligned(values, records));
}

const has = (values, id) => values[id] !== null && values[id] !== undefined;

function projectionData(model, data) {
  const { map } = data;
  const rowIds = model.rows.flatMap((_, id) => (has(map.x, id) && has(map.y, id) ? [id] : []));
  const axis = values => model.rows.map((_, id) => values[id] ?? NaN);
  const label = map.method.toUpperCase();
  return { fitted: true, method: map.method, mapName: map.name, name: `${map.name}-2d`, count: rowIds.length,
    config: structuredClone(model.config), coverage: [], inputFields: [], aggregation: 'imported',
    dimensions: map.dimensions ?? null, rowIds, representationId: null, featureSetId: `example:${data.table}`,
    precomputed: data.provenance ?? true, x: { values: axis(map.x), name: `${label} 1` }, y: { values: axis(map.y), name: `${label} 2` } };
}

function clusteringData(model, data, mapId) {
  const { clustering } = data;
  const rowIds = model.rows.flatMap((_, id) => (has(clustering.labels, id) ? [id] : []));
  const labels = rowIds.map(id => clustering.labels[id]);
  const groups = clusterGroups(labels);
  for (const [id, group] of Object.entries(groups)) {
    const given = clustering.groups?.[id];
    if (given?.name) { Object.assign(group, { name: given.name, nameEdited: true }); }
    if (given?.color) { group.color = given.color; }
  }
  return { name: clustering.name, method: clustering.method, parameters: { method: clustering.method, ...clustering.parameters },
    maxNamePhrases: 4, rowIds, labels, groups, inputMapId: mapId, featureSetId: `example:${data.table}`,
    config: structuredClone(model.config), precomputed: data.provenance ?? true };
}

// Saves the shipped map and clustering as results and shows their cards. Returns a note for the status line.
export function registerExampleResults(model, data) {
  if (!usableResults(data, model.rows.length)) { return 'data axes'; }
  const map = model.results.add('projection', projectionData(model, data));
  showMap(model, map);
  const clustering = model.results.add('clustering', clusteringData(model, data, map.id));
  clusterColumns(model, clustering);
  model.emit(Events.SCHEMA);
  showClustering(model, clustering);
  model.resultsChanged();
  model.emit(Events.VIEWS);
  return `precomputed ${data.map.name} map and ${data.clustering.name} clusters`;
}
