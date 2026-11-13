import { element } from './dom.js';
import { chip } from './chip.js';
import { clusterCondition, conditionText, legendHover } from './path-clusters.js';
import { Events } from './events.js';
import { categoryLabel, missing } from './schema.js';
import { valuePredicate } from './query-predicates.js';
import { negation } from './query-path.js';
import { valueColor } from './value-colors.js';
import { legendNames } from './cluster-legend-data.js';
import { isPointView } from './view-config.js';
import { UNASSIGNED } from './palette.js';

// A color key lists what the colors of a view mean: one chip per value (its dot, its label and a count).
// The cards of a map or scatter use one, and so does the phrase cloud, so a value looks the same wherever
// it is listed and a click does the same thing: it highlights those records (Alt-click: NOT).
const MAX_VALUES = 12; // The palette has twelve colors; more values would repeat them.

// A click on a chip becomes a query suggestion, which the search field adds to the path.
export function suggestCondition(model, condition, negate) {
  model.querySuggestion = negate ? negation(condition) : condition;
  model.emit(Events.DESCRIPTION_QUERY);
}

export const keyChip = options => chip({ ...options, className: 'legend-value' });

// The chips, then a small note when there is something to say about them.
function keyChildren(chips, notes) {
  return notes.length ? [...chips, element('small', { text: notes.join(' · ') })] : chips;
}

export function colorKey(chips, notes = []) {
  return element('div', { class: 'color-key' }, keyChildren(chips, notes));
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

// What a categorical column's colors mean on a map or scatter: its values, their colors and how many
// visible records have each. Returns the entries that fit and how many were left out.
export function fieldEntries(model, field) {
  const colorOf = valueColor(model, field);
  const values = orderValues(model, field, countValues(model, field));
  const entries = values.slice(0, MAX_VALUES).map(({ value, count }) => {
    const predicate = valuePredicate(field.name, value);
    const name = categoryLabel(value, field);
    return { color: colorOf(value) ?? UNASSIGNED, label: `${conditionText(model, predicate, name)} · ${count.toLocaleString()}`,
      title: `${name}: highlight these records (Alt-click: NOT)`, events: legendHover(clusterCondition(model, predicate)), predicate };
  });
  return { entries, more: Math.max(0, values.length - MAX_VALUES) };
}

// The chips for a column's values, wired to highlight on a click.
function fieldChips(model, field) {
  const { entries, more } = fieldEntries(model, field);
  const chips = entries.map(entry => keyChip({ ...entry, onclick: event => suggestCondition(model, entry.predicate, event.altKey) }));
  return { chips, more, entries };
}

// The key above a cloud whose phrases are tinted by a column: what each color is, and how a phrase gets its color.
export function tintKey(model, field) {
  const { chips, more } = fieldChips(model, field);
  const notes = [`a phrase takes the color of the ${field.name} value where most of its records are`, ...(more ? [`+${more} more values`] : [])];
  return colorKey(chips, notes);
}

// The key under a map or scatter card. It shows when the card is colored by a column and no legend card
// is paired with the map; a paired legend card already says what the colors mean.
export class CardColorKey {
  signature = '';

  constructor(model, config) {
    this.model = model;
    this.config = config;
    this.node = element('div', { class: 'color-key', hidden: '' });
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
    const { chips, more, entries } = field ? fieldChips(this.model, field) : { chips: [], more: 0, entries: [] };
    const signature = JSON.stringify([entries.map(({ color, label }) => [color, label]), more]);
    if (signature === this.signature) { return; }
    this.signature = signature;
    this.node.hidden = !entries.length;
    this.node.replaceChildren(...keyChildren(chips, more ? [`+${more} more values`] : []));
  }

  destroy() { this.cleanup.forEach(remove => remove()); }
}
