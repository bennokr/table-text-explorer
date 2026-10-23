import { $ } from './dom.js';

export function status(message, error = false) {
  $('#status').textContent = message;
  $('#status').classList.toggle('error', error);
}

export function complete(message, error = false) {
  $('#task-progress').hidden = true;
  status(message, error);
}

export function progress(update) {
  const task = typeof update === 'string' ? { message: update } : update;
  const bar = $('#task-progress');
  bar.hidden = false;
  bar.setAttribute('aria-label', task.message);
  if (task.total > 0) {
    bar.max = task.total;
    bar.value = task.completed;
  } else { bar.removeAttribute('value'); }
  $('#status').textContent = task.total > 0
    ? `${task.message} · ${Math.floor(100 * task.completed / task.total)}%` : task.message;
  $('#status').classList.remove('error');
}
