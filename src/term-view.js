import { element, display } from './dom.js';
import { phraseCloud } from './phrase-cloud.js';

export function comparisonSets(model, scope) {
  if (scope === 'filtered') {
    const visible = new Set(model.visible);
    return { subset: model.visible, comparison: model.rows.flatMap((_, id) => visible.has(id) ? [] : [id]) };
  }
  return { subset: model.visible.filter(id => model.selected.has(id)),
    comparison: model.visible.filter(id => !model.selected.has(id)) };
}

function excerpt(text, phrase = '') {
  const normalized = text.toLocaleLowerCase();
  const position = Math.max(0, normalized.indexOf(phrase.toLocaleLowerCase()));
  const start = Math.max(0, position - 80);
  return `${start ? '…' : ''}${text.slice(start, start + 320)}${text.length > start + 320 ? '…' : ''}`;
}

function examples(model, field, ids, phrase) {
  return element('ul', { class: 'term-excerpts' }, ids.map(id => element('li', {}, [
    element('button', { type: 'button', text: `Record ${id + 1}`, title: 'Show the full record without changing the subset',
      onclick: () => model.select([...model.selected], id) }),
    document.createTextNode(` ${excerpt(display(model.rows[id][field]), phrase)}`),
  ])));
}

const coverage = (count, total) => `${count} · ${total ? Math.round(100 * count / total) : 0}%`;
const score = value => value.toPrecision(3);

const headers = ['Phrase', 'Subset', 'Rest', 'c-TF-IDF', 'Δ', 'Lift'];

function termCounts(term, comparison) {
  return [coverage(term.support, term.subsetSize), comparison ? coverage(term.rest, term.restSize) : '—',
    score(term.ctfidf), comparison ? score(term.contrast) : '—', comparison ? `${(2 ** term.lift).toPrecision(3)}×` : '—'];
}

function termRow(term, show, comparison) {
  return element('tr', { 'data-term': term.phrase }, [element('td', {}, [element('button', {
    type: 'button', text: term.phrase, title: 'Show matching excerpts', onclick: () => show(term) })]),
  ...termCounts(term, comparison).map(text => element('td', { text }))]);
}

function fieldView(field, result, model, highlight, views) {
  const comparison = result.comparison > 0;
  const preview = element('div');
  const show = term => preview.replaceChildren(
    element('strong', { text: term.phrase }), element('button', { type: 'button', text: 'Highlight matches',
      onclick: () => highlight(field.name, term.phrase) }), examples(model, field.name, term.examples, term.phrase));
  const table = element('table', { class: 'term-table' }, [element('thead', {}, [element('tr', {},
    headers.map(text => element('th', { text })))]),
  element('tbody', {}, field.terms.map(term => termRow(term, show, comparison)))]);
  const packed = phraseCloud(field.terms, result.ranking ?? 'contrast',
    term => termCounts(term, comparison).map((value, index) => `${headers[index + 1]}: ${value}`).join(' · '), show);
  const toggle = element('input', { type: 'checkbox', 'aria-label': `Cloud view for ${field.name}` });
  toggle.checked = views.get(field.name) ?? false;
  toggle.onchange = () => { views.set(field.name, toggle.checked); table.hidden = toggle.checked; packed.hidden = !toggle.checked; };
  table.hidden = toggle.checked;
  packed.hidden = !toggle.checked;
  const heading = element('header', {}, [element('h3', { text: field.name }),
    element('small', { text: `${field.vocabulary.toLocaleString()} indexed terms` }),
    element('label', {}, [toggle, document.createTextNode('Cloud')])]);
  const representatives = element('details', {}, [element('summary', { text: 'Representative records' }),
    examples(model, field.name, field.representatives, '')]);
  return element('section', { class: 'term-field', 'data-field': field.name }, [heading, representatives,
    ...(field.terms.length ? [table, packed] : [element('p', {
      text: 'No terms meet the current support and ranking. Try a larger subset or lower minimum support.' })]), preview]);
}

export function renderTerms(container, result, model, highlight, views = new Map()) {
  for (const node of container.querySelectorAll('.term-cloud')) { node.dispose(); }
  container.replaceChildren(...result.fields.map(field => fieldView(field, result, model, highlight, views)));
}
