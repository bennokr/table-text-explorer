import { $ } from './dom.js';

export function showTermSettings(open) {
  $('#terms-controls').hidden = !open;
  $('#terms-options').setAttribute('aria-expanded', String(open));
}

export function bindTermSettings() {
  $('#terms-options').onclick = () => showTermSettings($('#terms-controls').hidden);
}

export function refreshDescriptionControls() {
  const content = $('#terms-content').value;
  const labels = {
    phrases: ['Common phrases', 'c-TF-IDF contrast', 'c-TF-IDF'],
    facets: ['Common predicates', 'Δ share', 'Subset share'],
    both: ['Common predicates', 'c-TF-IDF contrast / Δ share', 'c-TF-IDF / subset share'],
  };
  ['frequency', 'contrast', 'ctfidf'].forEach((ranking, index) => {
    $(`#terms-ranking option[value="${ranking}"]`).textContent = labels[content][index];
  });
  $('#terms-deduplicate').closest('label').hidden = content === 'facets';
}

export function termIndexState(ready, available = ready) {
  $('#terms-inspector').hidden = !available;
  $('#terms-options').disabled = !available;
  $('#terms-index-status').hidden = ready;
  $('#terms-empty').hidden = available;
  if (ready) { showTermSettings(false); }
}
