import { $, options } from './dom.js';
import { readEmbeddings } from './embedding-files.js';
import { sentenceModels, defaultSentenceModel } from './sentence-models.js';

const isImported = key => String(key).startsWith('import:');

// The sentence-model choices: the built-in encoders, then any embeddings imported for this table.
function sentenceChoices(model) {
  const imported = [...model.importedEmbeddings].map(([key, item]) => [key, `Imported · ${item.name} · ${item.dimensions}-d`]);
  return [...Object.entries(sentenceModels).map(([key, item]) => [key, item.label]), ...imported];
}

// A saved setting may name embeddings that are no longer loaded; fall back to the built-in model.
export function availableSentenceModel(model, config) {
  const wanted = config.sentenceModel ?? defaultSentenceModel(config.language);
  return isImported(wanted) && !model.importedEmbeddings.has(wanted) ? defaultSentenceModel(config.language) : wanted;
}

function refreshChoices(model, selected) {
  options($('#sentence-model'), sentenceChoices(model), selected);
  $('#sentence-chunking').disabled = isImported($('#sentence-model').value);
}

async function importFile(model, file) {
  const { features, dimensions, rowIds } = readEmbeddings(await file.arrayBuffer(), file.name, model.rows.length);
  model.embeddingSequence += 1;
  const key = `import:${model.embeddingSequence}`;
  model.importedEmbeddings.set(key, { name: file.name, features, dimensions, rowIds });
  refreshChoices(model, key);
}

export function bindEmbeddingImport(model) {
  $('#embedding-import').onclick = () => $('#embedding-file').click();
  $('#sentence-model').addEventListener('change', () => refreshChoices(model, $('#sentence-model').value));
  $('#embedding-file').onchange = async event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) { return; }
    try {
      await importFile(model, file);
      $('#map-error').textContent = '';
    } catch (error) {
      $('#map-error').textContent = error.message;
    }
    $('#sentence-model').dispatchEvent(new Event('change', { bubbles: true }));
  };
}

export { refreshChoices };
