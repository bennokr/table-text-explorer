import { $ } from './dom.js';

export function status(message, error = false) {
  for (const selector of ['#status', '#panel-status']) {
    const node = $(selector);
    node.textContent = message;
    node.title = message;
    node.classList.toggle('error', error);
  }
}

export function complete(message, error = false) {
  for (const selector of ['#task-progress', '#panel-progress']) { $(selector).hidden = true; }
  status(message, error);
}

export function progress(update) {
  const task = typeof update === 'string' ? { message: update } : update;
  for (const selector of ['#task-progress', '#panel-progress']) {
    const bar = $(selector);
    bar.hidden = false;
    bar.setAttribute('aria-label', task.message);
    if (task.total > 0) {
      bar.max = task.total;
      bar.value = task.completed;
    } else { bar.removeAttribute('value'); }
  }
  const message = task.total > 0 ? `${task.message} · ${Math.floor(100 * task.completed / task.total)}%` : task.message;
  status(message);
}

export function analysisControls(model) {
  const update = () => {
    $('#analysis-actions').hidden = model.analysisBusy;
    $('#analysis-progress').hidden = !model.analysisBusy;
    if (model.analysisBusy) { progress('Preparing analysis…'); }
  };
  model.on('busy', update);
  update();
}
