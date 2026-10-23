import { $, element, glyph, options } from './dom.js';
import { aggregate, countsFor } from './aggregate.js';
import { B, dimension, figure, linkRecords, palette, PlotHost, ticks } from './plot.js';
import { categorical, numberOf } from './schema.js';

function pointChart(model, fields, source) {
  const dimensions = fields.map(field => dimension(model.rows.map(row => categorical(field)
    ? row[field.name] : numberOf(row[field.name], field)), field));
  source.data = { x: dimensions[0].values, y: dimensions[1].values,
    row: model.rows.map((_, id) => id + 1) };
  const mask = new B.BooleanFilter({ booleans: model.rows.map(() => true) });
  const plot = figure({ x_axis_type: fields[0].kind === 'date' ? 'datetime' : 'linear',
    y_axis_type: fields[1].kind === 'date' ? 'datetime' : 'linear', tooltips: [['Row', '@row']] });
  plot.scatter({ x: { field: 'x' }, y: { field: 'y' }, source, color: palette[0],
    view: new B.CDSView({ filter: mask }), size: 5, alpha: 0.5,
    selection_color: '#d9772b', nonselection_alpha: 0.12 });
  dimensions.forEach((dimension, index) => {
    const axis = index === 0 ? plot.xaxes[0] : plot.yaxes[0];
    axis.axis_label = fields[index].name;
    if (dimension.labels) { ticks(axis, dimension.labels); }
  });
  const filter = () => {
    const visible = new Set(model.visible);
    mask.booleans = model.rows.map((_, id) => visible.has(id));
  };
  filter();
  return { plot, cleanup: [linkRecords(source, model), model.on('view', filter)] };
}

function aggregatePlot(groups, fields, source) {
  const plot = figure({ x_axis_type: groups.kind === 'histogram' && fields[0].kind === 'date' ? 'datetime' : 'linear',
    tooltips: [['Group', '@label'], ['Records', '@count'], ['Highlighted', '@selected']] });
  const base = { source, color: '#849bad', nonselection_alpha: 0.8 };
  if (groups.kind === 'histogram') {
    const geometry = { left: { field: 'left' }, right: { field: 'right' }, bottom: 0, source };
    plot.quad({ ...base, ...geometry, top: { field: 'count' }, line_color: '#ffffff' });
    plot.quad({ ...geometry, top: { field: 'selected' }, color: '#d9772b', alpha: 0.8 });
    plot.xaxes[0].axis_label = fields[0].kind === 'text' ? `${fields[0].name} · characters` : fields[0].name;
  } else if (groups.kind === 'category') {
    plot.hbar({ ...base, y: { field: 'y' }, left: 0, right: { field: 'count' }, height: 0.8 });
    plot.hbar({ source, y: { field: 'y' }, left: 0, right: { field: 'selected' },
      height: 0.8, color: '#d9772b' });
  } else {
    plot.rect({ source, x: { field: 'x' }, y: { field: 'y' }, width: 0.92, height: 0.92,
      fill_color: palette[0], fill_alpha: { field: 'alpha' }, line_color: { field: 'outline' }, line_width: 2 });
  }
  if (groups.xLabels) { ticks(plot.xaxes[0], groups.xLabels); plot.xaxes[0].major_label_orientation = 0.7; }
  if (groups.yLabels) { ticks(plot.yaxes[0], groups.yLabels); }
  return plot;
}

class ChartCard {
  cleanup = [];

  constructor(model, fields, remove, reportError) {
    this.model = model;
    this.fields = fields;
    this.node = element('section', { class: 'chart-card' });
    const header = element('header', {}, [element('span', { text: fields.map(field => field.name).join(' × ') }),
      glyph('×', 'Remove chart', remove)]);
    const container = element('div', { class: 'chart-plot' });
    this.absent = glyph('', 'Highlight visible records with missing values', () => {
      const visible = new Set(model.visible);
      model.select(this.groups.absent.filter(id => visible.has(id)));
    });
    this.absent.className = 'missing-count';
    this.node.append(header, container, this.absent);
    this.host = new PlotHost(container, reportError);
    this.source = new B.ColumnDataSource();
    const points = fields.length === 2 && !fields.every(categorical);
    if (points) {
      const result = pointChart(model, fields, this.source);
      this.cleanup.push(...result.cleanup);
      this.absent.hidden = true;
      this.host.show(result.plot);
    } else { this.setupAggregate(); }
  }

  setupAggregate() {
    this.groups = aggregate(this.model.rows, this.fields);
    this.update();
    this.source.selected.properties.indices.change.connect(() => {
      if (this.updating) { return; }
      const visible = new Set(this.model.visible);
      const ids = this.source.selected.indices.flatMap(index => this.groups.members[index]);
      this.model.select(ids.filter(id => visible.has(id)));
    });
    for (const type of ['view', 'selection']) { this.cleanup.push(this.model.on(type, () => this.update())); }
    this.host.show(aggregatePlot(this.groups, this.fields, this.source));
  }

  update() {
    const data = countsFor(this.groups, this.model);
    this.updating = true;
    this.source.data = data;
    this.source.selected.indices = data.selected.flatMap((count, index) => count ? [index] : []);
    this.updating = false;
    const visible = new Set(this.model.visible);
    const absent = this.groups.absent.filter(id => visible.has(id)).length;
    this.absent.textContent = `${absent} missing`;
    this.absent.disabled = !absent;
  }

  destroy() {
    this.cleanup.forEach(remove => remove());
    this.host.destroy();
    this.node.remove();
  }
}

export class ChartStack {
  cards = [];

  constructor(model, reportError) {
    this.model = model;
    this.reportError = reportError;
    $('#add-chart').onclick = () => this.open();
    $('#chart-form').onsubmit = event => {
      event.preventDefault();
      const names = [$('#chart-x').value, $('#chart-y').value].filter(Boolean);
      const fields = names.map(name => model.fields.find(field => field.name === name));
      if (fields.length === 2 && fields.some(field => field.kind === 'text')) {
        reportError(new Error('Text columns support length distributions. Choose other columns for a pair.'));
        return;
      }
      this.add(fields);
      $('#chart-dialog').close();
    };
    model.on('data', () => this.defaults());
    model.on('schema', () => this.rebuild());
    model.on('annotation', () => this.rebuild());
  }

  open() {
    const entries = this.model.fields.filter(field => field.kind !== 'empty').map(field => [field.name, `${field.name} · ${field.kind}`]);
    options($('#chart-x'), entries);
    options($('#chart-y'), [['', 'Distribution (one variable)'], ...entries]);
    $('#chart-dialog').showModal();
  }

  add(fields) {
    if (!fields.length) { return; }
    let card;
    const remove = () => { card.destroy(); this.cards = this.cards.filter(item => item !== card); };
    card = new ChartCard(this.model, fields, remove, this.reportError);
    this.cards.push(card);
    $('#charts').append(card.node);
  }

  defaults() {
    $('#charts').scrollTop = 0;
    this.cards.forEach(card => card.destroy());
    this.cards = [];
    const fields = this.model.fields.filter(field => field.kind !== 'empty' && !field.identifier);
    const category = fields.find(categorical);
    const number = fields.find(field => field.kind === 'number');
    const other = fields.find(field => field !== category && field !== number);
    [category, number, other].filter(Boolean).forEach(field => this.add([field]));
  }

  rebuild() {
    const configurations = this.cards.map(card => card.fields.map(field => field.name));
    this.cards.forEach(card => card.destroy());
    this.cards = [];
    configurations.forEach(names => this.add(names.map(name => this.model.fields.find(field => field.name === name))));
  }
}
