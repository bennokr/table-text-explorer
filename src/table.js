import { $, display, element, glyph } from './dom.js';
import { numberOf } from './schema.js';

const rowHeight = 25;

export const previewRows = (model, enabled) => enabled && model.selected.size
  ? model.visible.filter(id => model.selected.has(id)) : model.visible;

export class TableView {
  constructor(model, container) {
    this.model = model;
    this.container = container;
    this.start = -1;
    this.table = element('table', { class: 'data-table', 'aria-label': 'Records' });
    this.body = element('tbody');
    container.append(this.table);
    container.addEventListener('scroll', () => this.render());
    this.body.addEventListener('click', event => this.click(event));
    this.body.addEventListener('keydown', event => {
      if (['Enter', ' '].includes(event.key)) { event.preventDefault(); this.click(event); }
    });
    model.on('data', () => {
      this.anchor = undefined;
      this.sortField = null;
      this.container.scrollTop = 0;
      this.container.scrollLeft = 0;
      this.rebuild();
    });
    model.on('schema', () => this.rebuild());
    model.on('view', () => { this.container.scrollTop = 0; this.render(true); });
    model.on('selection', () => {
      if ($('#preview-selection').checked) { this.container.scrollTop = 0; }
      this.render(true);
    });
    $('#preview-selection').onchange = () => { this.container.scrollTop = 0; this.render(true); };
    model.on('annotation', () => this.render(true));
    new ResizeObserver(() => this.render(true)).observe(container);
  }

  rebuild() {
    const header = element('tr', {}, [element('th', { text: '#' })]);
    for (const field of this.model.fields) {
      const button = glyph(field.name, `Sort by ${field.name} · ${field.kind}`, () => this.sort(field));
      header.append(element('th', { title: field.label ?? field.name }, [button,
        element('small', { text: field.kind })]));
    }
    this.table.replaceChildren(element('thead', {}, [header]), this.body);
    this.render(true);
  }

  sort(field) {
    this.direction = this.sortField === field.name ? -this.direction : 1;
    this.sortField = field.name;
    const { rows } = this.model;
    this.model.sort = (a, b) => {
      if (['number', 'date'].includes(field.kind)) {
        const x = numberOf(rows[a][field.name], field), y = numberOf(rows[b][field.name], field);
        if (Number.isNaN(x)) { return Number.isNaN(y) ? a - b : 1; }
        if (Number.isNaN(y)) { return -1; }
        return this.direction * (x - y) || a - b;
      }
      return this.direction * display(rows[a][field.name]).localeCompare(display(rows[b][field.name]));
    };
    this.model.refresh();
  }

  click(event) {
    const target = event.target.closest('tr[data-id]');
    if (!target) { return; }
    const id = Number(target.dataset.id);
    let ids = [id];
    if (event.ctrlKey || event.metaKey) {
      const next = new Set(this.model.selected);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      ids = [...next];
    }
    if (event.shiftKey && this.anchor !== undefined) {
      const visible = previewRows(this.model, $('#preview-selection').checked);
      const a = visible.indexOf(this.anchor), b = visible.indexOf(id);
      ids = a < 0 ? [id] : visible.slice(Math.min(a, b), Math.max(a, b) + 1);
    }
    this.anchor = id;
    this.model.select(ids, id);
  }

  spacer(height) {
    const cell = element('td', { colspan: this.model.fields.length + 1 });
    cell.style.height = `${height}px`;
    return element('tr', { class: 'spacer', 'aria-hidden': 'true' }, [cell]);
  }

  row(id) {
    const row = this.model.rows[id];
    const selected = this.model.selected.has(id);
    return element('tr', { 'data-id': id, tabindex: '0',
      class: selected && !$('#preview-selection').checked ? 'selected' : '', 'aria-selected': String(selected) },
    [element('th', { text: id + 1, scope: 'row' }), ...this.model.fields.map(field =>
      element('td', { text: display(row[field.name]), title: display(row[field.name]) }))]);
  }

  render(force = false) {
    const visible = previewRows(this.model, $('#preview-selection').checked);
    $('#table-count').textContent = $('#preview-selection').checked ? `${visible.length.toLocaleString()} shown` : '';
    const start = Math.max(0, Math.floor(this.container.scrollTop / rowHeight) - 6);
    if (!force && start === this.start) { return; }
    this.start = start;
    const end = Math.min(visible.length, start + Math.ceil(this.container.clientHeight / rowHeight) + 14);
    this.body.replaceChildren(this.spacer(start * rowHeight),
      ...visible.slice(start, end).map(id => this.row(id)),
      this.spacer(Math.max(0, visible.length - end) * rowHeight));
  }
}
