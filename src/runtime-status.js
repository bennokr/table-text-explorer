import { $ } from './dom.js';

export function runtimeStatus(workers) {
  const update = () => {
    for (const [key, label] of [['python', 'Python'], ['sklearn', 'scikit-learn']]) {
      const node = $(`#${key}-status`);
      const state = workers.runtime[key];
      const labels = { idle: 'not loaded yet', loading: 'loading', loaded: 'loaded', failed: 'failed to load' };
      node.dataset.state = state;
      node.title = `${label}: ${labels[state]}`;
      node.setAttribute('aria-label', node.title);
    }
  };
  workers.addEventListener('runtime', update);
  update();
}
