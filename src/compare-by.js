import { $, element } from './dom.js';
import { candidateFields, columnKind, columnPayload, fieldGroups } from './compare-columns.js';
import { Events } from './events.js';
import { treeGroup } from './compare-choices.js';
import { colorColumn, setTermSettings, treeChoice } from './term-settings-model.js';
import { phraseSettings } from './phrase-config.js';
import { mapColumn } from './term-regions.js';

const MIN_POPULATION = 60;
const CACHED_SCREENS = 6;
const KINDS = ['Columns', 'Clusters', 'Annotations'];

// Dots grade the share of text variation a column explains, in steps of ten and three times the
// effect floor (0.01, 0.03, 0.10), so the same number of dots means the same thing in every table.
// Relative dots gave a weak 0.015 column three dots because it was the strongest one in its table.
const BANDS = [0.03, 0.1];

export function dots(column) {
  if (!column?.significant) { return '○○○'; }
  if (column.effect >= BANDS[1]) { return '●●●'; }
  return column.effect >= BANDS[0] ? '●●○' : '●○○';
}

// The column the map is colored by wins when it is significant, so the cloud explains the colors on the map.
// When no column is significant there is nothing to color by, and the cloud shows the population's phrases.
function bestChoice(screen, mapColumn) {
  const ranked = screen.columns.filter(column => column.significant).sort((a, b) => b.effect - a.effect);
  if (ranked.some(column => column.name === mapColumn)) { return `col:${mapColumn}`; }
  return ranked.length ? `col:${ranked[0].name}` : null;
}

function columnLabel(field, result) {
  const coverage = result && result.coverage < 0.995 ? ` ${Math.round(100 * result.coverage)}%` : '';
  const flag = result?.missing?.differs ? ' · missing differs' : '';
  return `${field.label ?? field.name} ${result ? dots(result) : ''}${coverage}${flag}`.trim();
}

// "By:" chooses the column whose values color the phrase cloud. Auto follows the highlight when
// there is one and otherwise the strongest significant column; without one it shows the population as it is.
// Columns that are not significant stay in the list: a weak column can still be the one worth looking at.
export class CompareBy {
  screens = new Map();
  indexId = null;

  constructor(model, change) {
    this.model = model;
    this.select = $('#terms-color');
    this.contrast = $('#terms-contrast');
    model.on(Events.DATA, () => { this.screens.clear(); this.fill(null); });
    model.on(Events.SELECTION, () => this.fill(this.current()));
    model.on(Events.VIEWS, () => { if (this.value === 'auto') { this.fill(this.current()); change(); } });
    for (const type of [Events.SCHEMA, Events.ANNOTATION, Events.RESULTS]) { model.on(type, () => this.fill(this.current())); }
    this.fill(null);
  }

  get value() { return this.model.termSettings.color; }

  mapColumn() { return this.model.views.find(view => view.type === 'map')?.color; }

  population() {
    const highlighted = this.model.visible.filter(id => this.model.selected.has(id));
    return highlighted.length ? highlighted : this.model.visible;
  }

  // Each value's own distinctive phrases (a contrast of one value against the rest) is the Automatic or Distinctive
  // Size; any other Size scores one population, and a Color column then tints its phrases (see tintField).
  distinctive() { return ['auto', 'contrast'].includes(this.model.termSettings.ranking); }

  // 'columns': one description per value of the Color column. 'highlight': one description of the highlight (or the
  // current records) against its Contrast.
  mode(indexId) {
    const column = this.value === 'auto' || this.value.startsWith('col:');
    if (!indexId || this.model.termSettings.content === 'facets' || !this.distinctive() || !column) { return 'highlight'; }
    return this.value === 'auto' && this.model.selected.size ? 'highlight' : 'columns';
  }

  // The column whose values tint each phrase when one population is scored: the chosen Color column, or for
  // semantic splits on Auto the column the map is colored by.
  tintField() {
    if (this.mode(this.indexId) === 'columns') { return null; }
    const name = colorColumn(this.model.termSettings);
    if (name) { return candidateFields(this.model).find(field => field.name === name) ?? null; }
    return this.value === 'auto' && this.model.termSettings.ranking === 'semantic' ? mapColumn(this.model) : null;
  }

  key(indexId, population) {
    const fields = candidateFields(this.model).map(field => `${field.name}:${field.kind}`).join('|');
    const sum = population.reduce((total, id) => total + id, 0);
    return `${this.model.revision}:${indexId}:${population.length}:${sum}:${fields}`;
  }

  current() { return this.indexId ? this.screens.get(this.key(this.indexId, this.population())) : null; }

  // The population and cache key when its columns have not been screened yet. Phrase screens also run
  // inside a highlight, so the dots always describe the records the cloud is about.
  pending(indexId) {
    this.indexId = indexId;
    if (!indexId || this.model.termSettings.content === 'facets') { return null; }
    const population = this.population();
    const key = this.key(indexId, population);
    return this.screens.has(key) || population.length < MIN_POPULATION ? null : { population, key };
  }

  // A screen job when the columns have not been screened for this population yet.
  plan(indexId) {
    const pending = this.pending(indexId);
    if (!pending) { return null; }
    const columns = candidateFields(this.model).map(field => columnPayload(this.model, field, pending.population));
    return { key: pending.key, payload: { task: 'column_screen', indexId, population: pending.population, columns } };
  }

  accept(key, screen) {
    this.screens.set(key, screen);
    for (const old of [...this.screens.keys()].slice(0, -CACHED_SCREENS)) { this.screens.delete(old); }
    this.fill(screen);
  }

  groupsFor(choice, population) {
    const field = candidateFields(this.model).find(item => `col:${item.name}` === choice);
    return field ? fieldGroups(this.model, field, population) : [];
  }

  labelFor(choice) {
    return String(choice).slice(4);
  }

  // The partition to color the cloud by, or null to describe the highlight as before.
  resolve(indexId) {
    if (this.mode(indexId) !== 'columns') { return null; }
    const population = this.population();
    // A column chosen by name works without a screen (small tables are not screened); it just has no dots.
    const screen = this.screens.get(this.key(indexId, population)) ?? (this.value.startsWith('col:') ? { columns: [] } : null);
    if (!screen) { return null; }
    const choice = this.value === 'auto' ? bestChoice(screen, this.mapColumn()) : this.value;
    const groups = this.groupsFor(choice, population);
    return groups.length >= 2 ? { population, groups, choice, label: this.labelFor(choice), screen } : null;
  }

  // Columns the screen found too sparse or too coarse to test are not offered at all.
  columnOptions(screen) {
    const results = new Map((screen?.columns ?? []).map(column => [column.name, column]));
    const kinds = Object.fromEntries(KINDS.map(kind => [kind, []]));
    for (const field of candidateFields(this.model)) {
      const result = results.get(field.name);
      if (screen && !result?.eligible) { continue; }
      kinds[columnKind(field)].push(new Option(columnLabel(field, result), `col:${field.name}`));
    }
    return KINDS.map(kind => [kind, kinds[kind]]);
  }


  // Auto, None, Source column (one cloud colored by the column a phrase comes from, when there are several), the columns, and a tree's branches.
  fill(screen) {
    const columns = this.columnOptions(screen).filter(([, list]) => list.length)
      .map(([label, list]) => element('optgroup', { label }, list));
    const several = this.model.termSettings.content !== 'phrases' || phraseSettings(this.model).fields.length > 1;
    const field = several ? [new Option('Source column', 'field')] : [];
    this.select.replaceChildren(new Option('Auto', 'auto'), new Option('None', 'none'), ...field, ...columns, ...treeGroup(this.model));
    if (![...this.select.options].some(option => option.value === this.value)) { setTermSettings(this.model, { color: 'auto' }); }
    this.select.options[0].text = this.autoLabel(screen);
    this.select.value = this.value;
    this.showContrast();
  }

  // Contrast matters only when no column splits the cloud into values (and no tree's branches do).
  showContrast() {
    const splitByValues = this.mode(this.indexId) === 'columns' || Boolean(treeChoice(this.model.termSettings));
    this.contrast.closest('label').hidden = splitByValues;
  }

  // Auto describes the highlight when there is one; the dots then say which column to condition on next.
  autoLabel(screen) {
    if (this.value === 'auto' && this.model.selected.size && this.mode(this.indexId) === 'highlight') { return 'Auto → highlighted records'; }
    const best = screen ? bestChoice(screen, this.mapColumn()) : null;
    if (best) { return `Auto → ${this.labelFor(best)}`; }
    return screen?.columns.some(column => column.eligible) ? 'Auto → no column stands out' : 'Auto';
  }
}
