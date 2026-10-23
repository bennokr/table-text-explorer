import { categorical, categoryLabel, keyOf } from './schema.js';

export const B = window.Bokeh;
export const palette = ['#527b9c', '#c88948', '#6b9277', '#a5759c', '#b6a34e', '#678f99',
  '#bc7373', '#7f83ae', '#8c9478', '#a68a70'];

export function figure(attributes = {}) {
  const { tooltips, ...options } = attributes;
  const plot = B.Plotting.figure({ width: 300, height: 200, output_backend: 'canvas',
    toolbar_location: 'right', tools: 'tap,box_select,reset', active_drag: 'box_select',
    min_border: 8, outline_line_color: null, ...options });
  if (tooltips) { plot.add_tools(new B.HoverTool({ tooltips })); }
  plot.toolbar.logo = null;
  for (const axis of [...plot.xaxis, ...plot.yaxis]) {
    axis.major_label_text_font_size = '10px';
    axis.axis_label_text_font_size = '11px';
  }
  for (const grid of [...plot.xgrid, ...plot.ygrid]) { grid.grid_line_color = '#eeeeee'; }
  return plot;
}

export function ticks(axis, labels) {
  axis.ticker = new B.FixedTicker({ ticks: labels.map((_, index) => index) });
  axis.major_label_overrides = new Map(labels.map((label, index) => [index, label.slice(0, 28)]));
}

export function dimension(values, field) {
  if (!field || !categorical(field)) { return { values, labels: null }; }
  const unique = [...new Map(values.map(value => [keyOf(value), value])).values()];
  const codes = new Map(unique.map((value, index) => [keyOf(value), index]));
  return { values: values.map(value => codes.get(keyOf(value))),
    labels: unique.map(value => categoryLabel(value, field)) };
}

export class PlotHost {
  version = 0;

  constructor(container, onError) { this.container = container; this.onError = onError; }

  async show(plot) {
    const version = ++this.version;
    this.release();
    try {
      plot.width = Math.max(180, this.container.clientWidth);
      plot.height = Math.max(100, this.container.clientHeight);
      const view = await B.Plotting.show(plot, this.container);
      if (this.version !== version) { view.remove(); return; }
      this.view = view;
      this.observer = new ResizeObserver(() => {
        plot.width = Math.max(180, this.container.clientWidth);
        plot.height = Math.max(100, this.container.clientHeight);
      });
      this.observer.observe(this.container);
    } catch (error) { this.onError(error); }
  }

  release() {
    this.observer?.disconnect();
    this.view?.remove();
    this.view = null;
    this.container.replaceChildren();
  }

  destroy() { this.version += 1; this.release(); }
}

export function linkRecords(source, model) {
  let updating = false;
  source.selected.properties.indices.change.connect(() => {
    if (!updating) { model.select([...source.selected.indices]); }
  });
  const sync = () => {
    updating = true;
    source.selected.indices = [...model.selected];
    updating = false;
  };
  sync();
  return model.on('selection', sync);
}
