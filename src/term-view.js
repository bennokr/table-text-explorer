import { $, element, display } from './dom.js';
import { phraseCloud } from './phrase-cloud.js';
import { displayFields, fieldColor } from './term-display.js';
import { descriptionTable, descriptionTooltip } from './term-table.js';

export function comparisonSets(model, scope) {
  if (scope === 'all') { return { subset: model.rows.map((_, id) => id), comparison: [] }; }
  if (scope === 'visible' || (scope === 'selection' && !model.selected.size)) {
    return { subset: model.visible, comparison: [] };
  }
  if (scope === 'filtered') {
    const visible = new Set(model.visible);
    return { subset: model.visible, comparison: model.rows.flatMap((_, id) => visible.has(id) ? [] : [id]) };
  }
  return { subset: model.visible.filter(id => model.selected.has(id)),
    comparison: model.visible.filter(id => !model.selected.has(id)) };
}

function excerpt(text) {
  return `${text.slice(0, 320)}${text.length > 320 ? '…' : ''}`;
}

function examples(model, field, ids) {
  return element('ul', { class: 'term-excerpts' }, ids.map(id => element('li', {}, [
    element('button', { type: 'button', text: `Record ${id + 1}`, title: 'Show the full record without changing the subset',
      onclick: () => model.select([...model.selected], id) }),
    document.createTextNode(` ${excerpt(display(model.rows[id][field]))}`),
  ])));
}

function fieldLegend(fields) {
  return element('div', { class: 'term-field-legend', 'aria-label': 'Phrase fields' }, fields.map((field, index) =>
    element('span', { text: field.name, style: `color: ${fieldColor(index)}`,
      title: field.kind === 'facets' ? `${field.population} scored records, including missing values`
        : `${field.textRecords ?? 0} records with usable text · ${field.population ?? 0} scored` })));
}

function facetHeading(field, toggle) {
  const counts = field.combined ? `${field.vocabulary} predicates` : `${field.vocabulary} predicates · ${field.population} scored`;
  return element('header', {}, [element('h3', { text: field.label ?? field.name, title: field.name }),
    element('small', { text: counts,
      title: 'All records count, including missing values. Up to 50 values and four fixed quantile ranges per field.' }),
    element('label', {}, [toggle, document.createTextNode('Cloud')])]);
}

function fieldHeading(field, toggle) {
  if (field.kind === 'facets') { return facetHeading(field, toggle); }
  const coverage = field.combined ? 'Field-specific phrases; colors identify fields'
    : `${field.textRecords ?? 0} records with usable text · ${field.population ?? 0} scored`;
  return element('header', {}, [element('h3', { text: field.name }),
    element('small', { text: field.combined ? `${field.vocabulary.toLocaleString()} indexed terms`
      : `${field.textRecords ?? 0} text records · ${field.population ?? 0} scored`, title: coverage }),
    element('label', {}, [toggle, document.createTextNode('Cloud')])]);
}

function fieldExtras(field, model) {
  if (field.combined) { return [fieldLegend(field.fields)]; }
  if (field.kind === 'facets') { return []; }
  const representatives = element('details', {}, [element('summary', { text: 'Representative records' }),
    examples(model, field.name, field.representatives ?? [])]);
  return [representatives];
}

function fieldView(field, result, model, activate, views) {
  const comparison = result.comparison > 0;
  const facets = field.kind === 'facets';
  const show = term => activate(term.field ?? field.name, term.phrase, term.predicate);
  const table = descriptionTable(field, result, show);
  const packed = phraseCloud(field.terms, result.ranking ?? 'contrast',
    term => descriptionTooltip({ ...term, field: term.field ?? field.name }, comparison, result.ranking), show);
  const toggle = element('input', { type: 'checkbox', 'aria-label': `Cloud view for ${field.name}` });
  const viewKey = facets ? `facets:${field.name}` : field.name;
  toggle.checked = views.get(viewKey) ?? true;
  toggle.onchange = () => { views.set(viewKey, toggle.checked); table.hidden = toggle.checked; packed.hidden = !toggle.checked; };
  table.hidden = toggle.checked;
  packed.hidden = !toggle.checked;
  const heading = fieldHeading(field, toggle);
  return element('section', { class: 'term-field', 'data-field': field.name }, [heading,
    ...fieldExtras(field, model),
    ...(field.terms.length ? [table, packed] : [element('p', {
      text: 'No predicates meet the current support and ranking. Try a larger subset or lower minimum support.' })])]);
}

export function clearTerms(container) {
  for (const node of container.querySelectorAll('.term-cloud')) { node.dispose(); }
  container.replaceChildren();
}

export function renderTerms(container, result, model, activate, views = new Map()) {
  clearTerms(container);
  const fields = displayFields(result.fields, $('#terms-display').value === 'combined');
  const facets = displayFields((result.facets ?? []).filter(field => field.terms.length), $('#terms-display').value === 'combined')
    .map(field => ({ ...field, kind: 'facets', ...(field.combined ? { name: 'Metadata facets' } : {}) }));
  container.replaceChildren(...[...fields, ...facets].map(field => fieldView(field, result, model, activate, views)));
  if (!fields.length && !facets.length) { container.append(element('p', { text: 'No predicates meet these settings. Choose fields or lower minimum support.' })); }
}
