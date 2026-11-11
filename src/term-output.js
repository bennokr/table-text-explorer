import { phrasePredicate } from './query-predicates.js';
import { negation } from './query-path.js';
import { renderCompare } from './compare-render.js';
import { renderTerms } from './term-view.js';
import { renderGroups, groupDescriptionStatus } from './cluster-descriptions.js';

function rankingHeading(ranking, phrasesOnly) {
  const named = { frequency: phrasesOnly ? 'Common phrases' : 'Common predicates', balanced: 'Even splits', semantic: 'Semantic splits' };
  return named[ranking] ?? (phrasesOnly ? 'Distinctive phrases' : 'Distinctive predicates');
}

function compareStatus(compare) {
  return `${compare.groups.length} values of ${compare.label} · ${compare.population.length.toLocaleString()} records`;
}

function statusMessage(result, model) {
  if (result.groups) { return groupDescriptionStatus(result.groups); }
  const base = `${result.subset} subset / ${result.comparison} comparison records`;
  if (!result.comparison) { return `${base} · no comparison; subset scores only`; }
  return model.populations.size ? `${base} · compared with the records before the last condition` : base;
}

export function describeHeading({ content, ranking }, compare) {
  return compare ? `Compare by ${compare.label}` : rankingHeading(ranking, content === 'phrases');
}

export function describeStatus(result, compare, model) {
  return compare ? compareStatus(compare) : statusMessage(result, model);
}

// A click on a phrase or facet value becomes a query suggestion; Alt negates it.
function suggestPredicate(model) {
  return (field, phrase, predicate, negate) => {
    const condition = predicate ?? phrasePredicate(field, phrase);
    model.querySuggestion = negate ? negation(condition) : condition;
    model.emit('description-query');
  };
}

export function renderResult(container, result, compare, { model, views }) {
  const activate = suggestPredicate(model);
  if (compare) { renderCompare(container, result, compare, { model, activate, views }); }
  else if (result.groups) { renderGroups(container, result.groups, model, activate, views); }
  else { renderTerms(container, result, model, activate, views); }
}
