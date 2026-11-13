import { Events } from './events.js';

// The description panel's settings as plain data on the model. The controls only display and edit it; everything
// that decides what to describe reads it from here, never from the page.
export function defaultTermSettings() {
  return {
    content: 'phrases', // phrases | facets | both
    // Size: how phrases are scored, which sets their size in the cloud.
    ranking: 'auto', // auto | frequency | contrast | ctfidf | lift | balanced | semantic
    embedding: '', // the embeddings behind semantic splits: a saved result's id or an imported file's key
    support: 2, // minimum matching records
    deduplicate: true,
    // Color: what colors the phrases. auto | none | field (one cloud, colored by text field) | col:<column>
    // (its values, or the value where most of a phrase's records are) | tree:<clustering id>.
    color: 'auto',
    // Contrast: what the highlighted records are compared with when no column colors the cloud.
    contrast: 'previous', // previous (the records before the last condition) | rest (of the table) | current | all
    treeComparison: 'siblings', // branch against its siblings, or against the rest of the visible records
    groupPage: 0, // which 20 branches of a tree are described
  };
}

// Changing a setting tells the panel; setting it to what it already is does nothing.
export function setTermSettings(model, patch) {
  const changed = Object.entries(patch).filter(([key, value]) => model.termSettings[key] !== value);
  if (!changed.length) { return false; }
  Object.assign(model.termSettings, Object.fromEntries(changed));
  model.emit(Events.TERM_SETTINGS);
  return true;
}

// Contrast choices and the records each one describes (see comparisonSets in term-view.js).
export const contrastScopes = { previous: 'selection', rest: 'filtered', current: 'visible', all: 'all' };

export const termScope = settings => contrastScopes[settings.contrast] ?? 'selection';

export const treeChoice = settings => (settings.color.startsWith('tree:') ? settings.color.slice(5) : null);

// The column a Color choice names, if it names one.
export const colorColumn = settings => (settings.color.startsWith('col:') ? settings.color.slice(4) : null);
