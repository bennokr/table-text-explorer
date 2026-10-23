const B = window.Bokeh;
let source;
let filter;
let histogram;

function updateHistogram() {
  const indices = source.selected.indices;
  const counts = [0, 0, 0, 0];
  for (const index of indices) { counts[index % 4] += 1; }
  histogram.data = { x: [0, 1, 2, 3], count: counts };
  document.querySelector('#selected').textContent = `${indices.length} highlighted`;
}

function scatter(title) {
  const plot = B.Plotting.figure({ title, width: 450, height: 290,
    output_backend: 'canvas', tools: 'pan,wheel_zoom,box_select,lasso_select,reset',
    active_drag: 'box_select' });
  plot.scatter({ x: { field: 'x' }, y: { field: 'y' }, source, size: 3,
    view: new B.CDSView({ filter }), alpha: 0.3, selection_color: '#dd6a28' });
  return plot;
}

export async function checkPlots() {
  const started = performance.now();
  const x = Array.from({ length: 20000 }, (_, index) => index % 200);
  const y = x.map((_, index) => Math.floor(index / 200));
  source = new B.ColumnDataSource({ data: { x, y } });
  filter = new B.BooleanFilter({ booleans: x.map(() => true) });
  histogram = new B.ColumnDataSource({ data: { x: [0, 1, 2, 3], count: [0, 0, 0, 0] } });
  source.selected.properties.indices.change.connect(updateHistogram);
  const first = scatter('20,000 records — brush to highlight');
  const second = scatter('Linked selection');
  const marginal = B.Plotting.figure({ title: 'Selected counts by group', width: 450,
    height: 220, output_backend: 'canvas', tools: '' });
  marginal.vbar({ x: { field: 'x' }, top: { field: 'count' }, width: 0.8, source: histogram });
  const layout = B.Plotting.gridplot([[first, second], [marginal, null]], { merge_tools: false });
  await B.Plotting.show(layout, '#plots');
  document.querySelector('#filter').onclick = () => {
    const selected = new Set(source.selected.indices);
    filter.booleans = x.map((_, index) => selected.has(index));
  };
  window.plotProbe = () => ({ selected: source.selected.indices.length,
    visible: filter.booleans.filter(Boolean).length,
    histogram: histogram.data.count.reduce((sum, count) => sum + count, 0),
    backend: first.output_backend, rows: source.data.x.length });
  return { rows: x.length, backend: first.output_backend,
    seconds: (performance.now() - started) / 1000 };
}
