import { element } from './dom.js';
import { renderTerms } from './term-view.js';

const PER_VALUE = 10; // Phrases each value contributes to the cloud.

// Each value's top phrases join one cloud; a phrase keeps the colour of the value it is most distinctive for.
function mergeTerms(lists) {
  const best = new Map();
  for (const { group, terms } of lists) {
    for (const term of terms.slice(0, PER_VALUE)) {
      const key = term.predicate ? JSON.stringify(term.predicate) : term.phrase;
      if (!best.has(key) || best.get(key).contrast < term.contrast) {
        best.set(key, { ...term, color: group.color, value: group.name });
      }
    }
  }
  return [...best.values()].sort((a, b) => b.contrast - a.contrast);
}

function mergeFields(groups, compare, read) {
  const first = read(groups[0].description) ?? [];
  // Each group's description counts only its own records; the cloud covers all the shown values together.
  const total = (index, key) => groups.reduce((sum, group) => sum + (read(group.description)[index][key] ?? 0), 0);
  return first.map((field, index) => ({
    ...field, representatives: [], textRecords: total(index, 'textRecords'), population: total(index, 'population'),
    terms: mergeTerms(groups.map(group => ({ group: compare.byId.get(group.id), terms: read(group.description)[index].terms }))),
  }));
}

function mergeGroups(result, compare) {
  const groups = result.groups.filter(group => compare.byId.has(group.id));
  const merged = { subset: compare.population.length, comparison: compare.population.length, ranking: 'contrast', separate: true };
  return { ...merged, fields: mergeFields(groups, compare, description => description.fields),
    facets: groups[0].description.facets ? mergeFields(groups, compare, description => description.facets) : [] };
}

function legendEntry(group, activate, model) {
  const label = `${group.name} · ${group.subset.length.toLocaleString()}`;
  const swatch = element('span', { class: 'legend-swatch', style: `background: ${group.color}` });
  return element('button', { type: 'button', class: 'legend-value', title: 'Highlight these records (Alt-click: NOT)',
    onclick: event => {
      if (group.predicate) { activate(null, null, group.predicate, event.altKey); } else { model.select(group.ids); }
    } }, [swatch, document.createTextNode(label)]);
}

function legendNotes({ column }) {
  const notes = [];
  if (!column) { return notes; }
  if (column.coverage < 0.995) { notes.push(`${Math.round(100 * column.coverage)}% of records have a value`); }
  if (column.eligible && !column.significant) { notes.push('not significant: these colours may reflect chance'); }
  if (column.missing?.differs) { notes.push('missing values differ in text, so this column may be biased'); }
  return notes;
}

function compareLegend(compare, activate, model) {
  const notes = legendNotes(compare);
  return element('div', { class: 'compare-legend', 'aria-label': `Values of ${compare.label}` }, [
    element('strong', { text: compare.label }), ...compare.groups.map(group => legendEntry(group, activate, model)),
    ...(notes.length ? [element('small', { text: notes.join(' · ') })] : [])]);
}

export function renderCompare(container, result, compare, { model, activate, views }) {
  const prepared = { ...compare, byId: new Map(compare.groups.map(group => [group.id, group])),
    column: compare.screen.columns.find(column => `col:${column.name}` === compare.choice) };
  renderTerms(container, mergeGroups(result, prepared), model, activate, views);
  container.prepend(compareLegend(prepared, activate, model));
}
