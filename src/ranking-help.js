// What the chosen ranking does, in one sentence: the tooltip of the "?" beside the panel heading. The longer
// explanation of each ranking is on the help page (descriptions#settings), which the button opens.
export function rankingHelp(ranking, content = 'phrases') {
  const what = content === 'facets' ? 'predicates' : 'phrases';
  const help = {
    auto: `Automatic: ${what} that mark the highlight against the previous step, or the most common ones with no highlight.`,
    frequency: `Common ${what}: the most frequent among these records, compared with nothing.`,
    balanced: 'Even splits: one yes/no question per column, the most even first.',
    semantic: 'Semantic splits: phrases that each split the records in a way the earlier ones do not; size is what the split adds.',
    contrast: `Contrast: how much more a ${content === 'facets' ? 'predicate' : 'phrase'} marks these records than the comparison records.`,
    ctfidf: 'c-TF-IDF: class-based term weighting of these records, with no comparison term.',
    lift: 'Lift: how many times more often it occurs in these records than in the comparison records.',
  };
  return help[ranking] ?? help.auto;
}
