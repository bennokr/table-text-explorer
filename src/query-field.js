import { $, element } from './dom.js';
import { formatQuery } from './query-predicates.js';
import { chipLabel } from './query-path.js';
import { clusterCondition, conditionText, legendHover, scrollToLegendRow } from './path-clusters.js';
import { chip } from './chip.js';
import { composeQuery, splitQuery } from './query-text.js';
import { suggest } from './query-suggest.js';
import { Events } from './events.js';

// The search field: conditions as removable tokens, then a draft being typed, with suggestions underneath.
// The conditions are the path of the drill-down (one per click or per Enter); `text` is the whole query.
export class QueryField {
  chips = []; // Parsed conditions, AND-ed.
  options = [];
  active = -1;

  constructor(model, { onedit, onsubmit, onremove }) {
    this.model = model;
    this.callbacks = { onedit, onsubmit, onremove };
    this.input = $('#search');
    this.list = $('#suggest-list');
    this.input.addEventListener('input', () => { this.publishText(); this.suggestions(); onedit(); });
    this.input.addEventListener('focus', () => this.suggestions());
    this.input.addEventListener('blur', () => setTimeout(() => this.close(), 120));
    this.input.addEventListener('keydown', event => this.key(event));
    for (const type of [Events.SELECTION, Events.DATA, Events.SCHEMA]) { model.on(type, () => this.showCount()); }
  }

  get text() { return composeQuery(this.chips.map(formatQuery), this.input.value); }

  // Setting the text rebuilds the conditions from it; text that is not a whole query becomes the draft.
  set text(value) {
    const { nodes, draft } = splitQuery(value, this.model.fields);
    this.chips = nodes;
    this.input.value = draft;
    this.render();
  }

  // Turns the draft into conditions when it is a whole query; the field keeps it as a draft otherwise.
  commit() {
    const text = this.text;
    const { nodes, draft } = splitQuery(text, this.model.fields);
    if (draft && text.trim()) { return false; }
    this.chips = nodes;
    this.input.value = '';
    this.render();
    return true;
  }

  removeChip(index) {
    this.chips.splice(index, 1);
    this.render();
    this.callbacks.onremove(index);
    return true;
  }

  render() {
    $('#search-chips').replaceChildren(...this.chips.map((node, index) => this.chip(node, index)));
    this.showCount();
    this.publishText();
  }

  // The whole query, readable from outside the field (tests, scripts) without reaching into its parts.
  publishText() {
    $('#search-box').dataset.query = this.text;
  }

  chip(node, index) {
    const cluster = clusterCondition(this.model, node);
    const full = chipLabel(node);
    // Hovering or clicking a cluster condition lights up its row in the legend.
    const events = cluster ? { ...legendHover(cluster),
      onclick: event => { if (event.target === event.currentTarget) { scrollToLegendRow(cluster.id); } } } : {};
    return chip({ color: cluster?.color, label: conditionText(this.model, node, full), title: full, className: 'path-chip', events,
      remove: { label: `Remove condition ${full}`, onclick: () => this.removeChip(index) } });
  }

  showCount() {
    const count = $('#search-count');
    const left = this.model.visible.filter(id => this.model.selected.has(id)).length;
    count.hidden = !this.chips.length;
    count.textContent = `${left.toLocaleString()} of ${this.model.visible.length.toLocaleString()}`;
    count.title = 'Records left after these conditions, of the visible records';
  }

  suggestions() {
    const { items, message, more } = suggest(this.model, this.input.value);
    this.options = items;
    this.active = -1;
    const notes = [message, more ? `${more} more columns: keep typing` : ''].filter(Boolean);
    this.list.replaceChildren(...items.map((item, index) => this.option(item, index)),
      ...notes.map(note => element('li', { class: 'suggest-note', role: 'presentation', text: note })));
    this.list.hidden = !items.length && !notes.length;
    $('#search-box').setAttribute('aria-expanded', String(!this.list.hidden));
  }

  option(item, index) {
    return element('li', { role: 'option', id: `suggest-${index}`, 'aria-selected': 'false',
      // mousedown, not click: the input must keep focus while the choice is made.
      onmousedown: event => { event.preventDefault(); this.choose(item); } },
    [element('span', { class: 'suggest-label', text: item.label }), element('small', { text: item.hint })]);
  }

  close() { this.list.hidden = true; this.active = -1; $('#search-box').setAttribute('aria-expanded', 'false'); }

  move(step) {
    if (!this.options.length) { return; }
    this.active = (this.active + step + this.options.length) % this.options.length;
    this.list.querySelectorAll('[role=option]').forEach((node, index) => {
      node.setAttribute('aria-selected', String(index === this.active));
      if (index === this.active) { node.scrollIntoView({ block: 'nearest' }); }
    });
    this.input.setAttribute('aria-activedescendant', `suggest-${this.active}`);
  }

  // A suggestion fills in the draft; one that completes a condition also turns it into a chip.
  choose(item) {
    this.input.value = item.draft;
    if (item.done) { this.submit(); return; }
    this.suggestions();
    this.callbacks.onedit();
  }

  submit() {
    this.commit();
    this.close();
    this.callbacks.onsubmit();
    return false;
  }

  // Arrow keys move through the suggestions; Enter or Tab take the highlighted one, otherwise Enter commits.
  // Each handler says whether it used the key, so the browser's own action is cancelled only then.
  key(event) {
    const picking = !this.list.hidden && this.options.length > 0 && this.active >= 0;
    const pick = () => { this.choose(this.options[this.active]); return true; };
    const handlers = {
      ArrowDown: () => { this.move(1); return true; },
      ArrowUp: () => { this.move(-1); return true; },
      // A search box clears itself on Escape; while suggestions are open it only closes them.
      Escape: () => { const open = !this.list.hidden; this.close(); return open; },
      Enter: () => (picking ? pick() : this.submit()),
      Tab: () => picking && pick(),
      Backspace: () => !this.input.value && this.chips.length > 0 && this.removeChip(this.chips.length - 1),
    };
    if (handlers[event.key]?.()) { event.preventDefault(); }
  }
}
