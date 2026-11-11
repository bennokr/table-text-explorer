import { withBase } from './base.js';
import { tableColumns } from './table-columns.js';
import { demoSettings } from './demo-settings.js';
import { registerExampleEmbeddings } from './example-embeddings.js';
import { $, options } from './dom.js';
import { Dataset } from './state.js';
import { importTable, importExample, exportTable, cancelImport } from './importers.js';
import { status, progress, complete, analysisControls } from './status.js';
import { bindSearch } from './search.js';
import { TableView } from './table.js';
import { recordViewer } from './record.js';
import { Views } from './views.js';
import { Analysis } from './analysis.js';
import { layout } from './layout.js';
import { diagnostics } from './diagnostics.js';
import { Projection } from './projection.js';
import { settings } from './settings.js';
import { Terms } from './terms.js';
import { bindEmbeddingImport } from './embedding-import.js';
import { Clustering } from './clustering.js';
import { renderResults } from './results-ui.js';
import { PhraseSettings } from './phrase-settings.js';
import { runtimeStatus } from './runtime-status.js';
import { bindHelp } from './help.js';
import { Events } from './events.js';

const model = new Dataset();
let importVersion = 0;
const exampleFiles = new Map();

const reportError = error => complete(error.message ?? String(error), true);

function summary() {
  $('#dataset-name').textContent = model.name ?? 'No table';
  $('#counts').textContent = `${model.visible.length.toLocaleString()} / ${model.rows.length.toLocaleString()} records · ${model.selected.size} highlighted`;
  $('#filter-selection').disabled = !model.selected.size;
  for (const id of ['export', 'add-chart', 'new-annotation', 'clear-selection']) {
    $(`#${id}`).disabled = !model.rows.length;
  }
  $('#column-types').disabled = !model.rows.length || model.analysisBusy;
  $('#analysis-inputs').disabled = model.rows.length < 2 || model.analysisBusy;
  $('#cancel').hidden = !model.analysisBusy;
}

async function load(action) {
  const version = ++importVersion;
  cancelImport();
  projection.cancel();
  analysis.busy(true);
  $('#cancel').hidden = true;
  progress({ message: 'Reading table locally' });
  try {
    const table = await action();
    if (version !== importVersion) { return; }
    progress({ message: 'Detecting column types and preparing views' });
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    if (version !== importVersion) { return; }
    model.load(table);
    demoSettings(model, table.demo, registerExampleEmbeddings(model, table.embeddings));
    const ignored = table.ignoredFields?.length ? ` · ${table.ignoredFields.length} structured columns ignored` : '';
    complete(`${table.name} · ${model.rows.length} records, ${model.fields.length} columns${ignored} · data axes`);
  } catch (error) { if (version === importVersion) { reportError(error); } }
  finally { if (version === importVersion) { analysis.busy(false); summary(); } }
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
    if (name) { load(() => importExample(name, progress, exampleFiles.get(name))); }
  };
  $('#export').onclick = () => {
    renderResults(model);
    $('#export-dialog').showModal();
  };
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

async function examples() {
  try {
    const response = await fetch(withBase('examples.json'));
    const files = response.ok ? await response.json() : [];
    for (const file of files) { exampleFiles.set(file.name, file); }
    options($('#examples'), [['', 'Examples…'], ...files.map(file => [file.name, file.name])]);
  } catch { status('Import a local file to start.'); }
}

tableColumns(model);
new TableView(model, $('#table-scroll'));
recordViewer(model, reportError);
const analysis = new Analysis(model, progress);
const projection = new Projection(model, analysis);
const openProjectionSettings = settings(model, projection, status);
new Views(model, reportError, openProjectionSettings);
runtimeStatus(analysis.workers);
new PhraseSettings(model, analysis);
analysis.workers.warmup();
analysisControls(model);
new Terms(model, analysis);
new Clustering(model, analysis);
layout();
bindHelp();
$('#analysis-inputs').onclick = openProjectionSettings;
$('#cancel').onclick = () => { projection.cancel(); complete('Analysis cancelled. Existing fits retained.'); };
bindImportExport();
bindEmbeddingImport(model);
bindSearch(model, analysis);
for (const type of [Events.DATA, Events.VIEW, Events.SELECTION, Events.SCHEMA, Events.BUSY]) { model.on(type, summary); }
summary();
examples();

diagnostics(model, analysis);
