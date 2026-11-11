import { $ } from './dom.js';
import { Events } from './events.js';

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

// Whole percent in 0..100, or null when the task has no usable total.
export function percent(task) {
  if (!(task?.total > 0)) { return null; }
  return Math.floor(100 * Math.min(Math.max(task.completed, 0), task.total) / task.total);
}

export function progress(update) {
  const task = typeof update === 'string' ? { message: update } : update;
  for (const selector of ['#task-progress', '#panel-progress']) {
    const bar = $(selector);
    bar.hidden = false;
    bar.setAttribute('aria-label', task.message);
    if (task.total > 0) {
      bar.max = task.total;
      bar.value = Math.min(task.completed, task.total);
    } else { bar.removeAttribute('value'); }
  }
  const done = percent(task);
  const message = done === null ? task.message : `${task.message} · ${done}%`;
  status(message);
}

export function analysisControls(model) {
  const update = () => {
    $('#analysis-actions').hidden = model.analysisBusy;
    $('#analysis-progress').hidden = !model.analysisBusy;
    if (model.analysisBusy) { progress('Preparing analysis…'); }
  };
  model.on(Events.BUSY, update);
  update();
}
