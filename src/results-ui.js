import { $, element } from './dom.js';
import { resultExport } from './results.js';
import { complete } from './status.js';

function downloadResult(result) {
  const url = URL.createObjectURL(resultExport(result));
  const anchor = element('a', { href: url, download: `${result.name.replace(/[^\p{L}\p{N}_-]/gu, '_')}.json` });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function corrections(model, result) {
  return element('button', { type: 'button', text: 'Copy names to annotation…', onclick: () => {
    const name = prompt('New annotation column name', `${result.name} · corrected`);
    if (name === null) { return; }
    try {
      const labels = new Map(result.rowIds.map((id, index) => [id, result.groups[result.labels[index]].name]));
      model.addAnnotation(name.trim(), labels);
      complete('Copied labels to an independent annotation. Future fits and name edits keep it unchanged.');
    } catch (error) { complete(error.message, true); }
  } });
}

function entry(model, result) {
  const name = element('input', { value: result.name, 'aria-label': 'Result name',
    onchange: event => { result.name = event.target.value.trim() || result.id;
      if (result.kind === 'projection') { result.mapName = result.name.replace(/-2d$/u, ''); }
      model.emit('results'); } });
  const buttons = [element('button', { type: 'button', text: 'Download JSON', onclick: () => downloadResult(result) })];
  if (['projection', 'clustering'].includes(result.kind)) {
    buttons.unshift(element('button', { type: 'button', text: result.kind === 'clustering' ? 'Open legend' : 'Open card', onclick: () => {
      model.openResultId = result.id;
      model.emit('open-result');
      $('#export-dialog').close();
    } }));
  }
  const details = element('details', {}, [element('summary', { text: 'Parameters and provenance' }),
    element('pre', { text: JSON.stringify({ id: result.id, created: result.created,
      source: result.sourceId ?? result.representationId, config: result.config,
      parameters: result.parameters, sentenceModel: result.sentenceModel, aggregation: result.aggregation,
      coverage: result.coverage, originalDimensions: result.dimensions }, null, 2) })]);
  const children = [name, element('span', { text: `${result.kind === 'projection' ? 'Similarity map' : result.kind} · ${result.rowIds.length} records` }), ...buttons, details];
  if (result.kind === 'representation') {
    children.push(element('p', { text: result.embeddings
      ? `Download includes pooled embeddings (${result.embeddingDimensions} dimensions) and prepared features. Neither appears as table columns.`
      : 'Download includes prepared analysis features, not word or sentence embeddings.' }));
  }
  if (result.groups) {
    children.push(corrections(model, result));
  }
  return element('section', { class: 'saved-result', 'data-result-id': result.id }, children);
}

export function renderResults(model) {
  const results = model.results.list();
  $('#results-list').replaceChildren(...(results.length ? results.map(result => entry(model, result))
    : [element('p', { text: 'Make a similarity map or clustering to save a result here.' })]));
}
