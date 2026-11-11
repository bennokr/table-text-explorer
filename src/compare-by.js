import { $, element } from './dom.js';
import { axisGroups, candidateFields, columnKind, columnPayload, fieldGroups } from './compare-columns.js';

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

function bestChoice(screen) {
  const ranked = screen.columns.filter(column => column.significant).sort((a, b) => b.effect - a.effect);
  if (ranked.length) { return `col:${ranked[0].name}`; }
  return screen.axes.length ? 'axis:0' : null;
}

function columnLabel(field, result) {
  const coverage = result && result.coverage < 0.995 ? ` ${Math.round(100 * result.coverage)}%` : '';
  const flag = result?.missing?.differs ? ' · missing differs' : '';
  return `${field.label ?? field.name} ${result ? dots(result) : ''}${coverage}${flag}`.trim();
}

// "Compare by" chooses the column whose values colour the phrase cloud. Auto follows the highlight when
// there is one and otherwise the strongest column the screen finds, else the main text axis.
export class CompareBy {
  value = 'auto';
  screens = new Map();
  indexId = null;

  constructor(model, change) {
    this.model = model;
    this.select = $('#terms-compare');
    this.select.onchange = () => { this.value = this.select.value; change(); };
    model.on('data', () => { this.screens.clear(); this.value = 'auto'; this.fill(null); });
    model.on('selection', () => this.fill(this.current()));
    for (const type of ['schema', 'annotation', 'results']) { model.on(type, () => this.fill(this.current())); }
    this.fill(null);
  }

  population() {
    const highlighted = this.model.visible.filter(id => this.model.selected.has(id));
    return highlighted.length ? highlighted : this.model.visible;
  }

  mode(indexId) {
    const ranked = $('#terms-ranking').value !== 'auto'; // A chosen ranking describes one population, not a column's values.
    if (!indexId || ranked || $('#terms-content').value === 'facets' || this.value === 'highlight') { return 'highlight'; }
    return this.value === 'auto' && this.model.selected.size ? 'highlight' : 'columns';
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
    if (!indexId || $('#terms-content').value === 'facets') { return null; }
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

  groupsFor(choice, screen, population) {
    if (choice?.startsWith('axis:')) {
      const axis = screen.axes[Number(choice.slice(5))];
      return axis ? axisGroups(axis) : [];
    }
    const field = candidateFields(this.model).find(item => `col:${item.name}` === choice);
    return field ? fieldGroups(this.model, field, population) : [];
  }

  labelFor(choice) {
    return choice?.startsWith('axis:') ? `text axis ${Number(choice.slice(5)) + 1}` : String(choice).slice(4);
  }

  // The partition to colour the cloud by, or null to describe the highlight as before.
  resolve(indexId) {
    if (this.mode(indexId) !== 'columns') { return null; }
    const population = this.population();
    const screen = this.screens.get(this.key(indexId, population));
    if (!screen) { return null; }
    const choice = this.value === 'auto' ? bestChoice(screen) : this.value;
    const groups = this.groupsFor(choice, screen, population);
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

  entries(screen) {
    const axes = (screen?.axes ?? []).map((axis, index) =>
      new Option(`Text axis ${index + 1} · ${Math.round(100 * axis.share)}% of variation`, `axis:${index}`));
    return [...this.columnOptions(screen), ['Text axes', axes]].filter(([, list]) => list.length);
  }

  fill(screen) {
    const groups = this.entries(screen).map(([label, list]) => element('optgroup', { label }, list));
    this.select.replaceChildren(new Option('Auto', 'auto'), new Option('Highlighted vs previous step', 'highlight'), ...groups);
    if (![...this.select.options].some(option => option.value === this.value)) { this.value = 'auto'; }
    this.select.options[0].text = this.autoLabel(screen);
    this.select.disabled = $('#terms-ranking').value !== 'auto';
    this.select.title = this.select.disabled ? 'Compare by applies to the Automatic ranking' : '';
    this.select.value = this.value;
  }

  // Auto describes the highlight when there is one; the dots then say which column to condition on next.
  autoLabel(screen) {
    if (this.value === 'auto' && this.model.selected.size && this.mode(this.indexId) === 'highlight') { return 'Auto → highlighted records'; }
    const best = screen ? bestChoice(screen) : null;
    return best ? `Auto → ${this.labelFor(best)}` : 'Auto';
  }
}
