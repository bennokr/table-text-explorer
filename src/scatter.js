import { temporal } from './dates.js';
import { B, dimension, figure, linkRecords, PlotHost, ticks } from './plot.js';
import { HIGHLIGHT, SERIES, UNASSIGNED } from './palette.js';
import { categoryColors } from './value-colors.js';
import { keyOf } from './schema.js';
import { hoverData } from './scatter-hover.js';
import { axisCoordinates } from './view-config.js';
import { Events } from './events.js';

const axisType = axis => temporal(axis.field) ? 'datetime' : 'linear';

function embeddingCoverage(coordinates) {
  const matched = coordinates.coverage.reduce((sum, field) => sum + field.matched, 0);
  const total = coordinates.coverage.reduce((sum, field) => sum + field.total, 0);
  const unit = coordinates.config.mode === 'sentences' ? 'tokens covered' : 'words recognized';
  return total ? ` · ${Math.round(100 * matched / total)}% ${unit}` : '';
}

export class Scatter {
  constructor(model, config, container, reportError) {
    this.model = model;
    this.config = config;
    this.host = new PlotHost(container, reportError);
    this.cleanup = [model.on(Events.VIEW, () => this.filter()),
      model.on(Events.RESULTS, () => this.refresh()),
      model.on(Events.ANNOTATION, () => this.refresh())];
    this.render();
  }

  refresh() {
    if (!this.source) { return; }
    if (this.config.type === 'scatter') {
      this.coordinates = axisCoordinates(this.model, this.config);
      const x = dimension(this.coordinates.x.values, this.coordinates.x.field);
      const y = dimension(this.coordinates.y.values, this.coordinates.y.field);
      this.source.data = { ...this.source.data, x: x.values, y: y.values };
      if (x.labels) { ticks(this.figure.xaxes[0], x.labels); }
      if (y.labels) { ticks(this.figure.yaxes[0], y.labels); }
    }
    this.paint();
    this.filter();
  }

  colorValues() {
    const name = this.config.color;
    const field = this.model.fields.find(field => field.name === name);
    const result = this.model.results.get(field?.derived);
    if (result) {
      const colors = new Map(result.rowIds.map((id, index) => [id, result.groups[result.labels[index]].color]));
      return this.model.rows.map((_, id) => colors.get(id) ?? UNASSIGNED);
    }
    if (!name) { return this.model.rows.map(() => SERIES); }
    const colors = categoryColors(this.model, field);
    return this.model.rows.map(row => colors.get(keyOf(row[name], field)));
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
    const coordinates = this.config.type === 'scatter' ? axisCoordinates(this.model, this.config) : this.model.resultFor(this.config);
    this.coordinates = coordinates;
    if (!coordinates) { return; }
    const x = dimension(coordinates.x.values, coordinates.x.field);
    const y = dimension(coordinates.y.values, coordinates.y.field);
    const hover = hoverData(this.model, coordinates);
    this.source = new B.ColumnDataSource({ data: { x: x.values, y: y.values,
      ...hover.data, color: this.colorValues() } });
    this.mask = new B.BooleanFilter({ booleans: this.model.rows.map(() => true) });
    const plot = this.plot(coordinates, x, y, hover.tooltips);
    this.figure = plot;
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
      selection_color: HIGHLIGHT, nonselection_alpha: 0.13 });
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

  destroy() {
    this.unlink?.();
    this.cleanup.forEach(remove => remove());
    this.host.destroy();
  }

  description(coordinates = this.coordinates) {
    if (!coordinates) { return 'Choose settings, then fit this view.'; }
    if (!coordinates.fitted) { return 'Data axes'; }
    const config = coordinates.config;
    const fields = config.features?.map(name => `${name} ×${config.weights[name] ?? 1}`).join(', ') || 'Automatic columns';
    const mode = config.mode === 'words' ? `${config.vectorLanguage.toUpperCase()} vectors · ${config.pooling} · ${config.combine}` : config.mode;
    const missing = this.model.rows.length - coordinates.count;
    return `${coordinates.method.toUpperCase()} · ${mode} · ${fields} · ${missing} unembedded${embeddingCoverage(coordinates)}`;
  }
}
