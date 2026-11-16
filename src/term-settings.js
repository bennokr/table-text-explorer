import { $ } from './dom.js';
import { rankingHelp } from './ranking-help.js';
import { setTermSettings } from './term-settings-model.js';

export function showTermSettings(open) {
  $('#terms-controls').hidden = !open;
  $('#terms-options').setAttribute('aria-expanded', String(open));
}

export function bindTermSettings() {
  $('#terms-options').onclick = () => showTermSettings($('#terms-controls').hidden);
}

export function refreshDescriptionControls(model) {
  const { content, ranking } = model.termSettings;
  const labels = {
    phrases: ['Common phrases', 'Distinctive phrases', 'c-TF-IDF'],
    facets: ['Common predicates', 'Distinctive predicates', 'Subset share'],
    both: ['Common predicates', 'Distinctive phrases and predicates', 'c-TF-IDF / subset share'],
  };
  ['frequency', 'contrast', 'ctfidf'].forEach((value, index) => {
    $(`#terms-ranking option[value="${value}"]`).textContent = labels[content][index];
  });
  $('#terms-deduplicate').closest('label').hidden = content === 'facets';
  $('#description-hint').title = rankingHelp(ranking, content);
  // Even splits ask "what is the most even yes/no question?", which only metadata predicates answer well:
  // for phrases it just repeats the common phrases.
  const even = $('#terms-ranking option[value="balanced"]');
  even.disabled = content === 'phrases';
  if (even.disabled && ranking === 'balanced') { setTermSettings(model, { ranking: 'auto' }); }
}

const DEFAULT_HEADING = 'Distinctive phrases';

// "<ranking> by <column>" in the panel head (the column may be cut short), and what Automatic chose in the Size
// select. Without a size (nothing is described) the head is the default and the select says plain Automatic.
export function showDescriptionHeading(model, size = null, by = '') {
  const text = [size ?? DEFAULT_HEADING, by].filter(Boolean).join(' by ');
  const heading = $('#description-kind');
  heading.textContent = text;
  heading.title = text;
  const automatic = size !== null && model.termSettings.ranking === 'auto';
  $('#terms-ranking option[value="auto"]').textContent = automatic ? `Auto → ${size}` : 'Automatic';
}

export function termIndexState(ready, available = ready) {
  $('#terms-inspector').hidden = !available;
  $('#terms-options').disabled = !available;
  $('#terms-index-status').hidden = ready;
  $('#terms-empty').hidden = available;
  if (ready) { showTermSettings(false); }
}
