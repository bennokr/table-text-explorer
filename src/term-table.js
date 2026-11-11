import { element } from './dom.js';
import { populationRankings, populationTooltip } from './term-display.js';

const coverage = (count, total) => `${count} · ${total ? Math.round(100 * count / total) : 0}%`;
const score = value => value.toPrecision(3);

const headers = ['Phrase', 'Subset', 'Rest', 'c-TF-IDF', 'Δ', 'Lift'];

function termCounts(term, comparison) {
  return [coverage(term.support, term.subsetSize), comparison ? coverage(term.rest, term.restSize) : '—',
    score(term.ctfidf), comparison ? score(term.contrast) : '—', comparison ? `${(2 ** term.lift).toPrecision(3)}×` : '—'];
}

function termRow(term, show, comparison, ranking) {
  const counts = populationRankings.has(ranking)
    ? [coverage(term.partitionSupport, term.population), score(term[ranking])]
    : termCounts(term, comparison);
  return element('tr', { 'data-term': term.phrase }, [element('td', {}, [element('button', {
    type: 'button', text: term.phrase, title: 'Add this exact phrase to the query with AND (Alt-click: NOT)', onclick: event => show(term, event) })]),
  ...(term.field ? [element('td', { text: term.field, style: `color: ${term.color}` })] : []),
  ...counts.map(text => element('td', { text }))]);
}

function facetCounts(term, comparison) {
  return [coverage(term.support, term.subsetSize), comparison ? coverage(term.rest, term.restSize) : '—',
    comparison ? `${(100 * term.contrast).toPrecision(3)} pp` : '—',
    comparison ? `${(2 ** term.lift).toPrecision(3)}×` : '—',
    comparison ? `${(100 * term.precision).toPrecision(3)}%` : '—'];
}

function facetRow(term, show, comparison, ranking) {
  const counts = populationRankings.has(ranking)
    ? [coverage(term.partitionSupport, term.population), score(term[ranking])] : facetCounts(term, comparison);
  return element('tr', {}, [element('td', {}, [element('button', { type: 'button', text: term.phrase,
    title: 'Add this predicate to the query with AND (Alt-click: NOT)', onclick: event => show(term, event) })]),
  ...(term.field ? [element('td', { text: term.field, style: `color: ${term.color}` })] : []),
  ...counts.map(text => element('td', { text }))]);
}

function termTooltip(term, comparison, ranking) {
  const counts = termCounts(term, comparison).map((value, index) => `${headers[index + 1]}: ${value}`).join(' · ');
  return `${term.field} · ${populationTooltip(term, ranking)} · ${counts} · Click to add this exact phrase to the query with AND · Alt-click for NOT`;
}

function facetTooltip(term, comparison, ranking) {
  const precision = comparison ? ` · Precision: ${(100 * term.precision).toPrecision(3)}%` : '';
  return `${term.field} · ${term.phrase} · Matches: ${coverage(term.support, term.subsetSize)} subset; ${coverage(term.rest, term.restSize)} rest${precision} · Recall: ${(100 * term.recall).toPrecision(3)}% · ${populationTooltip(term, ranking)} · Click to add this predicate to the query with AND · Alt-click for NOT`;
}

export function descriptionTable(field, result, show) {
  const facets = field.kind === 'facets';
  const base = facets ? ['Predicate', 'Subset / recall', 'Rest', 'Δ share', 'Lift', 'Precision'] : headers;
  const columns = populationRankings.has(result.ranking) ? [base[0], 'Contains', 'Score'] : base;
  const titles = field.combined ? [columns[0], 'Field', ...columns.slice(1)] : columns;
  const row = facets ? facetRow : termRow;
  return element('table', { class: 'term-table' }, [element('thead', {}, [element('tr', {},
    titles.map(text => element('th', { text })))]),
  element('tbody', {}, field.terms.map(term => row(term, show, result.comparison > 0, result.ranking)))]);
}

export function descriptionTooltip(term, comparison, ranking) {
  const text = term.kind === 'facet' ? facetTooltip(term, comparison, ranking) : termTooltip(term, comparison, ranking);
  return term.value ? `${term.value} · ${text}` : text;
}
