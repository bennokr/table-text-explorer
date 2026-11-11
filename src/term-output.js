import { $, element } from './dom.js';
import { phrasePredicate } from './query-predicates.js';
import { negation } from './query-path.js';
import { renderCompare } from './compare-render.js';
import { renderTerms } from './term-view.js';
import { tintByRegion } from './term-regions.js';
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

// The same status line appears in the settings, the index panel and the empty results area.
export function showMessage(text) {
  for (const id of ['terms-status', 'terms-index-status', 'terms-empty']) { $(`#${id}`).textContent = text; }
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

// Semantic splits say which phrases separate the records in meaning; colour says where on the map each one sits.
function renderSemantic(container, result, model, activate, views) {
  renderTerms(container, result, model, activate, views);
  const note = result.tinted
    ? 'Each phrase splits the records in a way the ones before it do not. Colour: the cluster most of its records are in; grey: spread over several.'
    : 'Each phrase splits the records in a way the ones before it do not. Colour the map by a clustering to see where each sits.';
  container.prepend(element('small', { class: 'term-note', text: note }));
}

export function renderResult(container, result, compare, { model, views }) {
  const activate = suggestPredicate(model);
  if (compare) { renderCompare(container, result, compare, { model, activate, views }); }
  else if (result.groups) { renderGroups(container, result.groups, model, activate, views); }
  else if (result.ranking === 'semantic') { renderSemantic(container, tintByRegion(model, result), model, activate, views); }
  else { renderTerms(container, result, model, activate, views); }
}
