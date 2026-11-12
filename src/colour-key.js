import { element } from './dom.js';
import { Events } from './events.js';
import { categoryLabel, missing } from './schema.js';
import { valuePredicate } from './query-predicates.js';
import { negation } from './query-path.js';
import { valueColor } from './value-colors.js';
import { legendNames } from './cluster-legend-data.js';
import { isPointView } from './view-config.js';
import { UNASSIGNED } from './palette.js';

// A colour key lists what the colours of a view mean: one chip per value (its dot, its label and a count).
// The cards of a map or scatter use one, and so does the phrase cloud, so a value looks the same wherever
// it is listed and a click does the same thing: it highlights those records (Alt-click: NOT).
const MAX_VALUES = 12; // The palette has twelve colours; more values would repeat them.

// A click on a chip becomes a query suggestion, which the search field adds to the path.
export function suggestCondition(model, condition, negate) {
  model.querySuggestion = negate ? negation(condition) : condition;
  model.emit(Events.DESCRIPTION_QUERY);
}

export function keyChip({ color, label, title, onclick, hover = {} }) {
  const dot = element('span', { class: 'legend-swatch chip-dot', style: `background: ${color}` });
  return element('button', { type: 'button', class: 'legend-value', title, ...hover, onclick }, [dot, document.createTextNode(label)]);
}

// The chips, then a small note when there is something to say about them.
function keyChildren(chips, notes) {
  return notes.length ? [...chips, element('small', { text: notes.join(' · ') })] : chips;
}

export function colourKey(chips, notes = []) {
  return element('div', { class: 'colour-key' }, keyChildren(chips, notes));
}

function countValues(model, field) {
  const counts = new Map();
  for (const id of model.visible) {
    const value = model.rows[id][field.name];
    if (missing(value, field)) { continue; }
    const entry = counts.get(String(value)) ?? { value, count: 0 };
    entry.count += 1;
    counts.set(String(value), entry);
  }
  return [...counts.values()];
}

// Clusters follow their legend card; other columns list their biggest values first.
function orderValues(model, field, values) {
  const result = model.results.get(field.derived);
  if (!result?.groups) { return values.sort((a, b) => b.count - a.count); }
  const names = legendNames(result);
  return values.sort((a, b) => names.indexOf(String(a.value)) - names.indexOf(String(b.value)));
}

// What a categorical column's colours mean on a map or scatter: its values, their colours and how many
// visible records have each. Returns the entries that fit and how many were left out.
export function fieldEntries(model, field) {
  const colorOf = valueColor(model, field);
  const values = orderValues(model, field, countValues(model, field));
  const entries = values.slice(0, MAX_VALUES).map(({ value, count }) => ({
    color: colorOf(value) ?? UNASSIGNED,
    label: `${categoryLabel(value, field)} · ${count.toLocaleString()}`,
    title: `${field.name} = ${value}: highlight these records (Alt-click: NOT)`,
    predicate: valuePredicate(field.name, value) }));
  return { entries, more: Math.max(0, values.length - MAX_VALUES) };
}

// The key under a map or scatter card. It shows when the card is coloured by a column and no legend card
// is paired with the map; a paired legend card already says what the colours mean.
export class CardColourKey {
  signature = '';

  constructor(model, config) {
    this.model = model;
    this.config = config;
    this.node = element('div', { class: 'colour-key', hidden: '' });
    this.cleanup = [Events.VIEW, Events.RESULTS, Events.ANNOTATION, Events.DATA, Events.SCHEMA]
      .map(type => model.on(type, () => this.sync()));
    this.sync();
  }

  field() {
    const { config, model } = this;
    if (!isPointView(config.type) || config.legendId || !config.color) { return null; }
    return model.fields.find(field => field.name === config.color) ?? null;
  }

  sync() {
    const field = this.field();
    const { entries, more } = field ? fieldEntries(this.model, field) : { entries: [], more: 0 };
    const signature = JSON.stringify([entries.map(({ color, label }) => [color, label]), more]);
    if (signature === this.signature) { return; }
    this.signature = signature;
    this.node.hidden = !entries.length;
    const chips = entries.map(entry => keyChip({ ...entry,
      onclick: event => suggestCondition(this.model, entry.predicate, event.altKey) }));
    this.node.replaceChildren(...keyChildren(chips, more ? [`+${more} more values`] : []));
  }

  destroy() { this.cleanup.forEach(remove => remove()); }
}
