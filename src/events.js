// Every event the dataset model emits. Subscribing to or emitting a name that is not here throws, so a typo
// ('view' for 'views') fails at once instead of silently never firing.
export const Events = Object.freeze({
  DATA: 'data', // New records were loaded.
  SCHEMA: 'schema', // Column types or labels changed.
  CONFIG: 'config', // Analysis defaults changed.
  VIEW: 'view', // Selection, filter or ordering changed what the cards show.
  VIEWS: 'views', // Cards were added, removed, moved or reconfigured.
  SELECTION: 'selection',
  ANNOTATION: 'annotation',
  RESULTS: 'results', // A map, clustering or representation was saved or changed.
  BUSY: 'busy', // The analysis queue started or finished.
  FIT_PROGRESS: 'fit-progress',
  ANALYSIS_CARD: 'analysis-card',
  OPEN_RESULT: 'open-result',
  NAME_CLUSTERS: 'name-clusters',
  DENSITY_SELECTION: 'density-selection',
  PHRASE_SETTINGS: 'phrase-settings',
  TEXT_INDEX: 'text-index',
  TABLE_COLUMNS: 'table-columns',
  TERM_SETTINGS: 'term-settings', // A setting of the description panel changed.
  DESCRIPTION_QUERY: 'description-query', // A phrase or value was clicked: add it to the query.
  DESCRIPTION_REMOVE: 'description-remove', // A path chip was removed.
});

const known = new Set(Object.values(Events));

export function checkedEvent(type) {
  if (!known.has(type)) { throw new Error(`Unknown model event "${type}". Add it to src/events.js.`); }
  return type;
}
