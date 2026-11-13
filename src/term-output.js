import { $ } from './dom.js';
import { phrasePredicate } from './query-predicates.js';
import { suggestCondition, tintKey } from './color-key.js';
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

// The heading is "<how the phrases are ranked> by <what colors them>"; `ranking` is what Automatic resolved to.
// Distinctive phrases of a highlight are distinctive for the highlighted records.
const NAMED_RANKINGS = ['frequency', 'balanced', 'semantic'];

function headingBy(ranking, compare, { highlighted, tint }) {
  if (compare) { return compare.label; }
  if (tint) { return tint.name; }
  return highlighted && !NAMED_RANKINGS.includes(ranking) ? 'highlighted records' : '';
}

export function describeHeading({ content, ranking }, compare, state = {}) {
  return { size: rankingHeading(ranking, content === 'phrases'), by: headingBy(ranking, compare, state) };
}

export function describeStatus(result, compare, model) {
  return compare ? compareStatus(compare) : statusMessage(result, model);
}

// A click on a phrase or facet value becomes a query suggestion; Alt negates it.
function suggestPredicate(model) {
  return (field, phrase, predicate, negate) => suggestCondition(model, predicate ?? phrasePredicate(field, phrase), negate);
}

// A population scored one way, its phrases tinted by the value of a column where most of their records are.
function renderTinted(container, result, tint, { model, activate, views }) {
  renderTerms(container, tintByRegion(model, result, tint), model, activate, views);
  container.prepend(tintKey(model, tint, activate));
}

export function renderResult(container, result, compare, { model, views, tint }) {
  const activate = suggestPredicate(model);
  if (compare) { renderCompare(container, result, compare, { model, activate, views }); }
  else if (result.groups) { renderGroups(container, result.groups, model, activate, views); }
  else if (tint) { renderTinted(container, result, tint, { model, activate, views }); }
  else { renderTerms(container, result, model, activate, views); }
}
