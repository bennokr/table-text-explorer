// Every color the app chooses by meaning lives here, so a value has one color wherever it appears: on the map,
// in the cluster legend, in the path chips and in the phrase clouds.

// Categories (clusters, column values, phrase fields) take these in order and wrap after twelve.
export const CATEGORY = ['#3979a5', '#d9772b', '#648c51', '#9b62a7', '#c34e58', '#529e9e', '#9d823c', '#707ac1',
  '#8d6e4a', '#c25b9a', '#5b6b7a', '#8fb339'];

export const categoryColor = index => CATEGORY[index % CATEGORY.length];

// "Everything else": the Other group, records without a cluster, phrases spread over several regions.
export const OTHER = '#999999';
export const UNASSIGNED = '#cccccc';

// The two ends of a numeric column, compared at its lowest and highest quarter.
export const LOW = CATEGORY[0];
export const HIGH = CATEGORY[4];

// Marks that are not categories: bars and points before any coloring, and the highlighted share.
export const NEUTRAL = '#849bad';
export const SERIES = '#527b9c';
export const HIGHLIGHT = '#d9772b';
