import { temporal } from './dates.js';
import { glyph } from './dom.js';
import { aggregate, countsFor } from './aggregate.js';
import { B, figure, PlotHost, ticks } from './plot.js';
import { HIGHLIGHT, NEUTRAL, SERIES } from './palette.js';
import { aggregateBrush } from './selection.js';
import { Events } from './events.js';
import { categorical } from './schema.js';
import { valueColor } from './value-colors.js';

const BAR_PIXELS = 14; // The room one bar, or one label of a heatmap, needs to stay readable.
const AXIS_ROOM = 44;
const MAX_VALUES = 60;

// How many values fit along an axis of this many pixels.
export const valuesThatFit = pixels => Math.min(MAX_VALUES, Math.max(5, Math.floor((pixels - AXIS_ROOM) / BAR_PIXELS)));

function histogramGlyphs(plot, source, fields) {
  const geometry = { left: { field: 'left' }, right: { field: 'right' }, bottom: 0, source };
  plot.quad({ source, color: NEUTRAL, nonselection_alpha: 0.8, ...geometry, top: { field: 'count' }, line_color: '#ffffff' });
  plot.quad({ ...geometry, top: { field: 'selected' }, color: HIGHLIGHT, alpha: 0.8 });
  plot.xaxes[0].axis_label = fields[0].kind === 'text' ? `${fields[0].name} · characters` : fields[0].name;
}

// Segments colored like the map, and a thin strip under each for the highlighted records.
function stackedGlyphs(plot, source) {
  plot.hbar({ source, left: { field: 'left' }, y: { field: 'y' }, right: { field: 'right' }, height: 0.8,
    fill_color: { field: 'color' }, line_color: '#ffffff', nonselection_alpha: 0.8 });
  plot.hbar({ source, left: { field: 'left' }, y: { field: 'strip' }, right: { field: 'stripRight' },
    height: 0.2, color: HIGHLIGHT });
}

function categoryGlyphs(plot, source) {
  plot.hbar({ source, color: NEUTRAL, nonselection_alpha: 0.8, y: { field: 'y' }, left: 0, right: { field: 'count' }, height: 0.8 });
  plot.hbar({ source, y: { field: 'y' }, left: 0, right: { field: 'selected' }, height: 0.8, color: HIGHLIGHT });
}

function heatmapGlyphs(plot, source) {
  plot.rect({ source, x: { field: 'x' }, y: { field: 'y' }, width: 0.92, height: 0.92,
    fill_color: SERIES, fill_alpha: { field: 'alpha' }, line_color: { field: 'outline' }, line_width: 2 });
}

const GLYPHS = { histogram: histogramGlyphs, stacked: stackedGlyphs, category: categoryGlyphs, heatmap: heatmapGlyphs };

function aggregatePlot(groups, fields, source) {
  const plot = figure({ x_axis_type: groups.kind === 'histogram' && temporal(fields[0]) ? 'datetime' : 'linear',
    tooltips: [['Group', '@label'], ['Records', '@count'], ['Highlighted', '@selected']] });
  GLYPHS[groups.kind](plot, source, fields);
  if (groups.xLabels) { ticks(plot.xaxes[0], groups.xLabels); plot.xaxes[0].major_label_orientation = 0.7; }
  if (groups.yLabels) { ticks(plot.yaxes[0], groups.yLabels); }
  return plot;
}

export class AggregateView {
  cleanup = [];

  constructor(model, config, container, reportError) {
    this.model = model;
    this.config = config;
    this.fields = [config.x, config.y].filter(Boolean).map(name => model.fields.find(field => field.name === name));
    this.absent = glyph('', 'Highlight visible records with missing values', () => {
      const visible = new Set(model.visible);
      model.select(this.groups.absent.filter(id => visible.has(id)));
    });
    this.absent.className = 'missing-count';
    container.after(this.absent);
    this.host = new PlotHost(container, reportError);
    this.source = new B.ColumnDataSource();
    this.container = container;
    this.setupAggregate(container);
  }

  // The first column of a bar chart runs down the card, the first column of a heatmap across it.
  limits() {
    const { clientWidth, clientHeight } = this.container;
    return this.fields.length === 2 ? [valuesThatFit(clientWidth), valuesThatFit(clientHeight)] : [valuesThatFit(clientHeight)];
  }

  options() {
    const stack = this.fields.length === 1 && this.model.fields.find(field => field.name === this.config.color);
    return { bins: Number(this.config.bins) || 0, limits: this.limits(),
      stack: stack && categorical(stack) ? { field: stack, colorOf: valueColor(this.model, stack) } : null };
  }

  setupAggregate(container) {
    this.groups = aggregate(this.model.rows, this.fields, this.options());
    this.update();
    this.figure = aggregatePlot(this.groups, this.fields, this.source);
    const brush = aggregateBrush(container, this.model, this.source, this);
    this.cleanup.push(brush);
    for (const type of [Events.VIEW, Events.SELECTION]) { this.cleanup.push(this.model.on(type, () => this.update())); }
    for (const type of [Events.ANNOTATION, Events.RESULTS]) {
      this.cleanup.push(this.model.on(type, () => this.refresh()));
    }
    this.watchSize(container);
    this.host.show(this.figure);
  }

  // A taller card has room for more bars: group the values again when the number that fit changes.
  watchSize(container) {
    this.fit = JSON.stringify(this.limits());
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(this.sizeFrame);
      this.sizeFrame = requestAnimationFrame(() => {
        if (this.groups.kind !== 'histogram' && JSON.stringify(this.limits()) !== this.fit) { this.regroup(); }
      });
    });
    observer.observe(container);
    this.cleanup.push(() => { cancelAnimationFrame(this.sizeFrame); observer.disconnect(); });
  }

  regroup() {
    this.fit = JSON.stringify(this.limits());
    this.groups = aggregate(this.model.rows, this.fields, this.options());
    if (this.groups.xLabels) { ticks(this.figure.xaxes[0], this.groups.xLabels); }
    if (this.groups.yLabels) { ticks(this.figure.yaxes[0], this.groups.yLabels); }
    this.update();
  }

  refresh() {
    const colored = this.config.color && this.groups.kind === 'stacked';
    if (colored || this.fields.some(field => field.annotation || field.derived)) { this.regroup(); } else { this.update(); }
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
    this.absent.hidden = !absent;
  }

  description() { return 'Highlighted records over current filtered counts'; }

  destroy() {
    this.cleanup.forEach(remove => remove());
    this.host.destroy();
    this.absent.remove();
  }
}
