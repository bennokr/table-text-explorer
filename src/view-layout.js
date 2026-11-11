import { previewPush, previewRow } from './view-push-preview.js';
import { $, element } from './dom.js';
import { HANDLE, packRows, fittedWidths, fittedHeight, snappedHeight } from './view-layout-math.js';
import { viewDivider } from './view-divider.js';
import { resizeCards } from './view-resize.js';
import { CardDrag } from './view-card-drag.js';
import { Events } from './events.js';

export class ViewLayout {
  widths = new Map();
  heights = new Map();
  breaks = new Set();
  order = [];
  rows = [];
  handles = new Map();

  constructor(model) {
    this.model = model;
    this.container = $('#views');
    this.cardDrag = new CardDrag(this);
    this.observer = new ResizeObserver(() => this.schedule());
    this.observer.observe(this.container);
  }

  reset() {
    cancelAnimationFrame(this.frame);
    this.widths.clear();
    this.heights.clear();
    this.breaks.clear();
    this.handles.clear();
    this.order = [];
    this.groups = [];
    this.rows = [];
    this.resizing = null;
    this.pushSlot = null;
    this.place([]);
  }

  schedule() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.render());
  }

  sync(cards) {
    this.order = cards.map(card => ({ id: card.config.id, node: card.node }));
    this.cardDrag.bind(cards);
    this.schedule();
  }

  reorder(order) {
    const configs = new Map(this.model.views.map(view => [view.id, view]));
    this.model.views = order.map(card => configs.get(card.id));
    this.model.emit(Events.VIEWS);
  }

  setGroups(groups) {
    const remaining = groups.filter(group => group.length);
    this.breaks = new Set(remaining.slice(1).map(group => group[0].id));
    this.widths.clear();
    this.reorder(remaining.flat());
  }

  moveEarlier(id) {
    const groups = this.groups.map(group => [...group]);
    const row = groups.findIndex(group => group.some(card => card.id === id));
    const index = groups[row].findIndex(card => card.id === id);
    const previous = index ? groups[row] : groups[row - 1];
    if (!previous) { return; }
    const position = index ? index - 1 : previous.length - 1;
    [groups[row][index], previous[position]] = [previous[position], groups[row][index]];
    this.setGroups(groups);
  }

  resetWidths(group) {
    group.forEach(card => this.widths.delete(card.id));
    this.schedule();
  }

  handle(key, axis, start, reset) {
    if (!this.handles.has(key)) { this.handles.set(key, viewDivider(axis, start, reset)); }
    const node = this.handles.get(key);
    node.begin = start;
    node.reset = reset;
    return node;
  }

  render() {
    const visible = this.order.filter(card => !card.node.hidden);
    const width = this.container.clientWidth;
    if (!width) { return; }
    if (!visible.length) { this.place([]); return; }
    const groups = this.resizing?.groups ?? packRows(visible, width, this.breaks);
    this.groups = groups;
    const preview = previewPush(this, groups, width);
    const baseline = fittedHeight(this.container.clientHeight, preview.groups.length);
    const nodes = [];
    preview.groups.forEach((group, index) => {
      let row = this.rows[index];
      if (!row) { row = element('div', { class: 'view-row' }); }
      this.rows[index] = row;
      const height = this.container.dataset.expanded ? baseline : this.heights.get(group[0].id) ?? baseline;
      row.style.gridTemplateRows = `minmax(${height}px, auto)`;
      previewRow(row, group, preview, height);
      this.renderRow(row, group, width, preview);
      for (const card of group) {
        card.node.querySelector('.move-up').disabled = !this.cardDrag.previous(card.id);
      }
      nodes.push(row);
      if (index < preview.groups.length - 1) {
        nodes.push(this.handle(`y-${index}`, 'y', () => this.resizeRow(row, group[0].id, baseline), () => {
          this.heights.delete(group[0].id);
          this.schedule();
        }));
      }
    });
    this.place(nodes);
    for (const [key, node] of this.handles) {
      if (!node.isConnected) { this.handles.delete(key); }
    }
  }

  resizeRow(row, id, baseline) {
    const initial = row.clientHeight;
    const original = this.heights.get(id);
    const change = delta => {
      this.heights.set(id, snappedHeight(initial + delta, baseline));
      this.schedule();
    };
    change.finish = cancel => {
      if (!cancel) { return; }
      if (original === undefined) { this.heights.delete(id); }
      else { this.heights.set(id, original); }
      this.schedule();
    };
    return change;
  }

  renderRow(row, group, width, preview) {
    const resizing = this.resizing?.groups.includes(group) ? this.resizing : null;
    const preferences = this.resizing && !resizing ? new Map() : this.widths;
    const sizes = fittedWidths(group, width, preferences)
      .map((size, index) => resizing?.sizes.get(group[index].id) ?? size);
    const tracks = [];
    const children = [];
    group.forEach((card, index) => {
      if (index) {
        tracks.push(`${HANDLE}px`);
        const handle = this.handle(`x-${card.id}`, 'x', () => resizeCards(this, group, index), () => this.resetWidths(group));
        handle.setAttribute('aria-valuenow', String(Math.round(sizes[index - 1])));
        children.push(handle);
      }
      tracks.push(`minmax(0, ${sizes[index]}px)`);
      children.push(preview.source === group && this.resizing.card === card ? this.pushSlot : card.node);
    });
    row.style.gridTemplateColumns = tracks.join(' ');
    // Remove the replaced slot first so insertion never moves the captured divider.
    for (const node of [...row.children]) {
      if (!children.includes(node)) { node.remove(); }
    }
    children.forEach((node, index) => {
      if (row.children[index] !== node) { row.insertBefore(node, row.children[index] ?? null); }
    });
  }

  pushCard(group, card) {
    const index = this.groups.indexOf(group);
    const groups = this.groups.map(row => row.filter(item => item !== card));
    if (groups[index + 1]) { groups[index + 1].unshift(card); }
    else { groups.push([card]); }
    this.setGroups(groups);
  }

  place(nodes) {
    nodes.forEach((node, index) => {
      if (this.container.children[index] !== node) {
        this.container.insertBefore(node, this.container.children[index] ?? null);
      }
    });
    for (const node of [...this.container.children]) {
      if (node.id !== 'views-empty' && !nodes.includes(node)) { node.remove(); }
    }
    $('#views-empty').hidden = this.order.length > 0;
  }
}
