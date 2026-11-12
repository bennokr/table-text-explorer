import { Events } from './events.js';

// The description panel's settings as plain data on the model. The controls only display and edit it; everything
// that decides what to describe reads it from here, never from the page.
export function defaultTermSettings() {
  return {
    content: 'phrases', // phrases | facets | both
    ranking: 'auto', // auto | frequency | contrast | ctfidf | lift | balanced | semantic
    embedding: '', // saved embedding result behind semantic splits
    support: 2, // minimum matching records
    deduplicate: true,
    display: 'separate', // one cloud per field, or one coloured by field
    // What the phrases are compared by: auto, highlight, population:<all|visible|filtered>, col:<column>
    // or tree:<clustering id>.
    compare: 'auto',
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

export const populationScopes = ['all', 'visible', 'filtered'];

// The comparison scope of the ordinary (non-column) descriptions.
export function termScope(settings) {
  const [kind, name] = settings.compare.split(':');
  return kind === 'population' && populationScopes.includes(name) ? name : 'selection';
}

export const treeChoice = settings => (settings.compare.startsWith('tree:') ? settings.compare.slice(5) : null);
