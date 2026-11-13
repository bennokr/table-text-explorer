import { element } from './dom.js';
import { phraseCloud } from './phrase-cloud.js';
import { displayFields, fieldColor } from './term-display.js';
import { descriptionTable, descriptionTooltip } from './term-table.js';
import { conjuncts, coveredByPath } from './query-path.js';

const FEW_RECORDS = 30;

export function comparisonSets(model, scope) {
  if (scope === 'all') { return { subset: model.rows.map((_, id) => id), comparison: [] }; }
  if (scope === 'visible' || (scope === 'selection' && !model.selected.size)) {
    return { subset: model.visible, comparison: [] };
  }
  if (scope === 'filtered') {
    const visible = new Set(model.visible);
    return { subset: model.visible, comparison: model.rows.flatMap((_, id) => visible.has(id) ? [] : [id]) };
  }
  const subset = model.visible.filter(id => model.selected.has(id));
  // After a click the comparison is the previous step: the records before the last condition.
  const before = model.populations?.get(conjuncts(model.ast).length - 1);
  const rest = before ?? model.visible;
  return { subset, comparison: rest.filter(id => !model.selected.has(id)) };
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

function fieldExtras(field) {
  return field.combined ? [fieldLegend(field.fields)] : [];
}

function fieldView(field, result, model, activate, views) {
  const comparison = result.comparison > 0;
  const facets = field.kind === 'facets';
  const show = (term, event) => activate(term.field ?? field.name, term.phrase, term.predicate, event?.altKey);
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
    ...fieldExtras(field),
    ...(field.terms.length ? [table, packed] : [element('p', {
      text: 'No predicates meet the current support and ranking. Try a larger subset or lower minimum support.' })])]);
}

export function clearTerms(container) {
  for (const node of container.querySelectorAll('.term-cloud')) { node.dispose(); }
  container.replaceChildren();
}

function withoutPath(fields, path) {
  return fields.map(field => ({ ...field, terms: field.terms.filter(term => !coveredByPath(term, field.name, path)) }));
}

export function renderTerms(container, result, model, activate, views = new Map()) {
  clearTerms(container);
  const path = conjuncts(model.ast);
  const combined = !result.separate && model.termSettings.display === 'combined';
  const fields = displayFields(withoutPath(result.fields, path), combined);
  const facets = displayFields(withoutPath(result.facets ?? [], path).filter(field => field.terms.length), combined)
    .map(field => ({ ...field, kind: 'facets', ...(field.combined ? { name: 'Metadata facets' } : {}) }));
  container.replaceChildren(...[...fields, ...facets].map(field => fieldView(field, result, model, activate, views)));
  if (result.subset > 0 && result.subset < FEW_RECORDS) {
    container.prepend(element('p', { class: 'term-note', text: `Only ${result.subset} records: contrasts are noisy, so treat this as exploration.` }));
  }
  if (!fields.length && !facets.length) { container.append(element('p', { text: 'No predicates meet these settings. Choose fields or lower minimum support.' })); }
}
