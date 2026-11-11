import { temporal } from './dates.js';
import { glyph } from './dom.js';
import { aggregate, countsFor } from './aggregate.js';
import { B, figure, PlotHost, ticks } from './plot.js';
import { HIGHLIGHT, NEUTRAL, SERIES } from './palette.js';
import { aggregateBrush } from './selection.js';
import { Events } from './events.js';

function aggregatePlot(groups, fields, source) {
  const plot = figure({ x_axis_type: groups.kind === 'histogram' && temporal(fields[0]) ? 'datetime' : 'linear',
    tooltips: [['Group', '@label'], ['Records', '@count'], ['Highlighted', '@selected']] });
  const base = { source, color: NEUTRAL, nonselection_alpha: 0.8 };
  if (groups.kind === 'histogram') {
    const geometry = { left: { field: 'left' }, right: { field: 'right' }, bottom: 0, source };
    plot.quad({ ...base, ...geometry, top: { field: 'count' }, line_color: '#ffffff' });
    plot.quad({ ...geometry, top: { field: 'selected' }, color: HIGHLIGHT, alpha: 0.8 });
    plot.xaxes[0].axis_label = fields[0].kind === 'text' ? `${fields[0].name} · characters` : fields[0].name;
  } else if (groups.kind === 'category') {
    plot.hbar({ ...base, y: { field: 'y' }, left: 0, right: { field: 'count' }, height: 0.8 });
    plot.hbar({ source, y: { field: 'y' }, left: 0, right: { field: 'selected' },
      height: 0.8, color: HIGHLIGHT });
  } else {
    plot.rect({ source, x: { field: 'x' }, y: { field: 'y' }, width: 0.92, height: 0.92,
      fill_color: SERIES, fill_alpha: { field: 'alpha' }, line_color: { field: 'outline' }, line_width: 2 });
  }
  if (groups.xLabels) { ticks(plot.xaxes[0], groups.xLabels); plot.xaxes[0].major_label_orientation = 0.7; }
  if (groups.yLabels) { ticks(plot.yaxes[0], groups.yLabels); }
  return plot;
}

export class AggregateView {
  cleanup = [];

  constructor(model, config, container, reportError) {
    this.model = model;
    this.fields = [config.x, config.y].filter(Boolean).map(name => model.fields.find(field => field.name === name));
    this.absent = glyph('', 'Highlight visible records with missing values', () => {
      const visible = new Set(model.visible);
      model.select(this.groups.absent.filter(id => visible.has(id)));
    });
    this.absent.className = 'missing-count';
    container.after(this.absent);
    this.host = new PlotHost(container, reportError);
    this.source = new B.ColumnDataSource();
    this.setupAggregate(container);
  }

  setupAggregate(container) {
    this.groups = aggregate(this.model.rows, this.fields);
    this.update();
    this.figure = aggregatePlot(this.groups, this.fields, this.source);
    const brush = aggregateBrush(container, this.model, this.source, this);
    this.cleanup.push(brush);
    for (const type of [Events.VIEW, Events.SELECTION]) { this.cleanup.push(this.model.on(type, () => this.update())); }
    for (const type of [Events.ANNOTATION, Events.RESULTS]) {
      this.cleanup.push(this.model.on(type, () => this.refresh()));
    }
    this.host.show(this.figure);
  }

  refresh() {
    if (this.fields.some(field => field.annotation || field.derived)) {
      this.groups = aggregate(this.model.rows, this.fields);
      if (this.groups.xLabels) { ticks(this.figure.xaxes[0], this.groups.xLabels); }
      if (this.groups.yLabels) { ticks(this.figure.yaxes[0], this.groups.yLabels); }
    }
    this.update();
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
