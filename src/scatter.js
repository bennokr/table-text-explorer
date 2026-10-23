import { $, options } from './dom.js';
import { B, dimension, figure, linkRecords, palette, PlotHost, ticks } from './plot.js';
import { categorical, keyOf } from './schema.js';
import { hoverData } from './scatter-hover.js';

const axisType = axis => axis.field?.kind === 'date' ? 'datetime' : 'linear';

export class Scatter {
  constructor(model, reportError, slot = 0) {
    this.model = model;
    this.slot = slot;
    this.host = new PlotHost($(slot ? '#scatter-secondary' : '#scatter'), reportError);
    model.on('coordinates', () => this.render());
    model.on('view', () => this.filter());
    model.on('data', () => this.colors());
    model.on('schema', () => { this.colors(); this.paint(); });
    model.on('annotation', () => this.paint());
    $('#color').addEventListener('change', () => this.paint());
  }

  colors() {
    const fields = this.model.fields.filter(field => categorical(field) && field.unique.length <= 30);
    options($('#color'), [['', 'None'], ...fields.map(field => [field.name, field.name])], $('#color').value);
  }

  colorValues() {
    const name = $('#color').value;
    const keys = [...new Set(this.model.rows.map(row => keyOf(row[name])))];
    const colors = new Map(keys.map((key, index) => [key, palette[index % palette.length]]));
    return this.model.rows.map(row => name ? colors.get(keyOf(row[name])) : palette[0]);
  }

  paint() {
    if (this.source) { this.source.data = { ...this.source.data, color: this.colorValues(),
      ...hoverData(this.model, this.coordinates).data }; }
  }

  filter() {
    if (!this.mask) { return; }
    const visible = new Set(this.model.visible);
    this.mask.booleans = this.model.rows.map((_, id) => visible.has(id)
      && Number.isFinite(this.source.data.x[id]) && Number.isFinite(this.source.data.y[id]));
  }

  render() {
    const coordinates = this.model.projections?.[this.slot];
    if (coordinates === this.coordinates) { return; }
    this.coordinates = coordinates;
    this.unlink?.();
    this.source = null;
    this.mask = null;
    this.host.destroy();
    const label = $(`#projection-info-${this.slot}`);
    label.textContent = this.description(coordinates);
    label.title = label.textContent;
    if (!coordinates) { return; }
    const x = dimension(coordinates.x.values, coordinates.x.field);
    const y = dimension(coordinates.y.values, coordinates.y.field);
    const hover = hoverData(this.model, coordinates);
    this.source = new B.ColumnDataSource({ data: { x: x.values, y: y.values,
      ...hover.data, color: this.colorValues() } });
    this.mask = new B.BooleanFilter({ booleans: this.model.rows.map(() => true) });
    const plot = this.plot(coordinates, x, y, hover.tooltips);
    this.unlink = linkRecords(this.source, this.model);
    this.filter();
    this.host.show(plot);
  }

  plot(coordinates, x, y, tooltips) {
    const plot = figure({ tools: 'pan,wheel_zoom,box_select,lasso_select,tap,reset',
      x_axis_type: axisType(coordinates.x), y_axis_type: axisType(coordinates.y),
      tooltips });
    plot.scatter({ x: { field: 'x' }, y: { field: 'y' }, color: { field: 'color' },
      source: this.source, view: new B.CDSView({ filter: this.mask }), size: 5, alpha: 0.65,
      selection_color: '#d9772b', nonselection_alpha: 0.13 });
    plot.xaxes[0].axis_label = coordinates.x.name;
    plot.yaxes[0].axis_label = coordinates.y.name;
    if (x.labels) { ticks(plot.xaxes[0], x.labels); }
    if (y.labels) { ticks(plot.yaxes[0], y.labels); }
    if (coordinates.fitted) {
      for (const axis of [...plot.xaxis, ...plot.yaxis]) { axis.visible = false; }
      for (const grid of [...plot.xgrid, ...plot.ygrid]) { grid.visible = false; }
    }
    return plot;
  }

  description(coordinates) {
    if (!coordinates) { return 'Choose settings, then fit this view.'; }
    if (!coordinates.fitted) { return 'Data axes'; }
    const config = coordinates.config;
    const fields = config.features?.map(name => `${name} ×${config.weights[name] ?? 1}`).join(', ') || 'Automatic columns';
    const mode = config.mode === 'words' ? `${config.vectorLanguage.toUpperCase()} vectors · ${config.pooling} · ${config.combine}` : config.mode;
    const missing = this.model.rows.length - coordinates.count;
    const matched = coordinates.coverage.reduce((sum, field) => sum + field.matched, 0);
    const total = coordinates.coverage.reduce((sum, field) => sum + field.total, 0);
    const coverage = total ? ` · ${Math.round(100 * matched / total)}% words recognized` : '';
    return `${coordinates.method.toUpperCase()} · ${mode} · ${fields} · ${missing} unembedded${coverage}`;
  }
}
