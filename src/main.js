import { $, options } from './dom.js';
import { Dataset } from './state.js';
import { importTable, importExample, exportTable, cancelImport } from './importers.js';
import { status, progress, complete } from './status.js';
import { parseQuery } from './query.js';
import { TableView } from './table.js';
import { recordViewer } from './record.js';
import { Scatter } from './scatter.js';
import { ChartStack } from './charts.js';
import { Projection } from './projection.js';
import { settings } from './settings.js';

const model = new Dataset();
let importVersion = 0;

const reportError = error => complete(error.message ?? String(error), true);

function summary() {
  $('#dataset-name').textContent = model.name ?? 'No table';
  $('#counts').textContent = `${model.visible.length.toLocaleString()} / ${model.rows.length.toLocaleString()} records · ${model.selected.size} highlighted`;
  $('#filter-selection').disabled = !model.selected.size;
  for (const id of ['export', 'add-chart', 'new-annotation']) {
    $(`#${id}`).disabled = !model.rows.length;
  }
  $('#fit').disabled = !model.rows.length || $('#scatter-panel').getAttribute('aria-busy') === 'true';
  $('#fit-secondary').disabled = $('#fit').disabled;
}

async function load(action) {
  const version = ++importVersion;
  cancelImport();
  projection.cancel();
  projection.busy(true);
  $('#cancel').hidden = true;
  progress({ message: 'Reading table locally' });
  try {
    const table = await action();
    if (version !== importVersion) { return; }
    $('#search').value = '';
    $('#search').removeAttribute('aria-invalid');
    progress({ message: 'Detecting column types and preparing views' });
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    if (version !== importVersion) { return; }
    model.load(table);
    if (table.name === 'crawlfeeds-booking.csv') {
      model.configure({ ...model.config, mode: 'words', language: 'en', vectorLanguage: 'en',
        features: ['positive_review_text', 'negative_review_text'] });
    }
    complete(`${table.name} · ${model.rows.length} records, ${model.fields.length} columns · data axes`);
  } catch (error) { if (version === importVersion) { reportError(error); } }
  finally { if (version === importVersion) { projection.busy(false); summary(); } }
}

function bindImportExport() {
  $('#import').onclick = () => $('#file').click();
  $('#file').onchange = () => {
    const file = $('#file').files[0];
    if (file) { $('#examples').value = ''; load(() => importTable(file, progress)); }
    $('#file').value = '';
  };
  $('#examples').onchange = () => {
    const name = $('#examples').value;
    if (name) { load(() => importExample(name, progress)); }
  };
  $('#export').onclick = () => $('#export-dialog').showModal();
  $('#export-form').onsubmit = event => {
    event.preventDefault();
    const format = $('#export-format').value;
    const url = URL.createObjectURL(exportTable(model, format, $('#export-scope').value));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${model.name.replace(/\.[^.]+$/, '')}-annotated.${format}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#export-dialog').close();
  };
}

function bindSearch() {
  let timeout;
  const apply = () => {
    try {
      const parsed = parseQuery($('#search').value, model.fields);
      model.query = parsed.test;
      model.ast = parsed.ast;
      $('#search').removeAttribute('aria-invalid');
      model.refresh();
      status('Search applied · existing projections unchanged.');
    } catch (error) {
      $('#search').setAttribute('aria-invalid', 'true');
      status(`${error.message} Keeping the last valid search.`, true);
    }
  };
  $('#search').oninput = () => { clearTimeout(timeout); timeout = setTimeout(apply, 180); };
  $('#search').onkeydown = event => {
    if (event.key === 'Enter') { clearTimeout(timeout); apply(); }
  };
  $('#filter-selection').onclick = () => { model.pinned = new Set(model.selected); model.refresh(); };
  $('#clear-filters').onclick = () => {
    clearTimeout(timeout);
    $('#search').value = '';
    $('#search').removeAttribute('aria-invalid');
    model.pinned = null;
    model.query = () => true;
    model.ast = null;
    model.refresh();
    status('Filters cleared · existing projections unchanged.');
  };
  $('#clear-selection').onclick = () => model.select([], model.active);
}

async function examples() {
  try {
    const response = await fetch('/examples.json');
    const files = response.ok ? await response.json() : [];
    options($('#examples'), [['', 'Examples…'], ...files.map(file => [file.name, file.name])]);
  } catch { status('Import a local file to start.'); }
}

new TableView(model, $('#table-scroll'));
recordViewer(model, reportError);
new Scatter(model, reportError);
new Scatter(model, reportError, 1);
const projection = new Projection(model, status);
new ChartStack(model, reportError);
settings(model, status);
bindImportExport();
bindSearch();
for (const type of ['data', 'view', 'selection', 'schema']) { model.on(type, summary); }
summary();
examples();

// Read-only diagnostics for browser tests; no complete records are exposed here.
window.explorer = {
  snapshot: () => ({ rows: model.rows.length, visible: model.visible.length,
    selected: [...model.selected], active: model.active,
    fields: model.fields.map(({ name, kind, unique }) => ({ name, kind, cardinality: unique.length })),
    projection: model.coordinates?.method ?? 'axes', fittedRows: model.coordinates?.x.values.length ?? 0,
    coordinates: model.coordinates?.x.values.slice(0, 4),
    projections: model.projections?.map(value => value && ({ method: value.method ?? 'axes',
      count: value.count, coordinates: value.x.values.slice(0, 4), config: value.config,
      dimensions: value.dimensions, coverage: value.coverage })),
    progress: { visible: !$('#task-progress').hidden, value: $('#task-progress').value,
      determinate: $('#task-progress').hasAttribute('value'), message: $('#status').textContent },
    busy: Boolean(projection.workers.pending), revision: model.revision }),
};
