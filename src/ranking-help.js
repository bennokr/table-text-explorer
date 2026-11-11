// What the chosen ranking does, in a sentence or two: the tooltip of the "?" beside the panel heading.
const FACET = 'Predicates are metadata values: a category, a range, or missing.';

export function rankingHelp(ranking, content = 'phrases') {
  const what = content === 'facets' ? 'predicates' : 'phrases';
  const help = {
    auto: `Automatic: compares your highlighted records with the records before the last condition (c-TF-IDF contrast), `
      + `or lists the most common ${what} when nothing is highlighted. Compare by colours ${what} by the values of a column.`,
    frequency: `Common ${what}: the most frequent among these records, without comparing them to anything.`,
    balanced: `Even splits: one yes/no question per column, most even first, with at least the minimum number of records on each side. ${FACET}`,
    semantic: 'Semantic splits: phrases chosen one after another, each splitting the records in a way the ones before it do not, '
      + 'measured on the saved embeddings. Size is what the split adds. Colour is the cluster where most of its records are, '
      + 'in the map\'s colours; grey is spread over several. Colour the map by a clustering to see them.',
    contrast: `Contrast: how much more a ${content === 'facets' ? 'predicate' : 'phrase'} marks these records than the comparison records.`,
    ctfidf: 'c-TF-IDF: class-based term weighting of these records, with no comparison term.',
    lift: 'Lift: how many times more often it occurs in these records than in the comparison records, smoothed.',
  };
  return help[ranking] ?? help.auto;
}
