import { $, options } from './dom.js';
import { B, dimension, figure, linkRecords, palette, PlotHost, ticks } from './plot.js';
import { categorical, keyOf } from './schema.js';

const axisType = axis => axis.field?.kind === 'date' ? 'datetime' : 'linear';

export class Scatter {
  constructor(model, reportError) {
    this.model = model;
    this.host = new PlotHost($('#scatter'), reportError);
    model.on('coordinates', () => this.render());
    model.on('view', () => this.filter());
    model.on('data', () => this.colors());
    model.on('schema', () => { this.colors(); this.paint(); });
    model.on('annotation', () => this.paint());
    $('#color').onchange = () => this.paint();
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
    if (this.source) { this.source.data = { ...this.source.data, color: this.colorValues() }; }
  }

  filter() {
    if (!this.mask) { return; }
    const visible = new Set(this.model.visible);
    this.mask.booleans = this.model.rows.map((_, id) => visible.has(id));
  }

  render() {
    const coordinates = this.model.coordinates;
    if (!coordinates) { return; }
    this.unlink?.();
    const x = dimension(coordinates.x.values, coordinates.x.field);
    const y = dimension(coordinates.y.values, coordinates.y.field);
    this.source = new B.ColumnDataSource({ data: { x: x.values, y: y.values,
      row: this.model.rows.map((_, index) => index + 1), color: this.colorValues() } });
    this.mask = new B.BooleanFilter({ booleans: this.model.rows.map(() => true) });
    const plot = figure({ tools: 'pan,wheel_zoom,box_select,lasso_select,tap,reset',
      x_axis_type: axisType(coordinates.x), y_axis_type: axisType(coordinates.y),
      tooltips: [['Row', '@row'], ['X', '@x'], ['Y', '@y']] });
    plot.scatter({ x: { field: 'x' }, y: { field: 'y' }, color: { field: 'color' },
      source: this.source, view: new B.CDSView({ filter: this.mask }), size: 5, alpha: 0.65,
      selection_color: '#d9772b', nonselection_alpha: 0.13 });
    plot.xaxes[0].axis_label = coordinates.x.name;
    plot.yaxes[0].axis_label = coordinates.y.name;
    if (x.labels) { ticks(plot.xaxes[0], x.labels); }
    if (y.labels) { ticks(plot.yaxes[0], y.labels); }
    this.unlink = linkRecords(this.source, this.model);
    this.filter();
    this.host.show(plot);
  }
}
