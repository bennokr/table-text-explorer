import { element } from './dom.js';
import { percent } from './status.js';
import { Events } from './events.js';

export class ViewPlaceholder {
  constructor(model, config, container, make) {
    this.model = model;
    this.config = config;
    this.container = container;
    this.button = element('button', { type: 'button', text: 'New similarity map', onclick: make });
    this.bar = element('progress', { hidden: '', 'aria-label': 'View fitting progress' });
    this.status = element('p', { class: 'fit-status', role: 'status' });
    this.node = element('div', { class: 'view-placeholder' }, [this.button,
      element('p', { text: 'Arrange similar records close together, using the inputs you chose. Fits on all records.' }),
      this.bar, this.status]);
    this.cleanup = model.on(Events.FIT_PROGRESS, () => this.paint());
  }

  sync(visible) {
    this.visible = visible;
    if (visible) { this.container.append(this.node); }
    else { this.node.remove(); }
    this.paint();
  }

  paint() {
    if (!this.visible) { return; }
    const fitting = this.model.fittingViewId === this.config.id;
    const update = this.model.fitProgress;
    const task = update?.viewId === this.config.id ? update : null;
    this.button.disabled = this.model.analysisBusy;
    this.button.textContent = fitting ? 'Making similarity map…' : 'New similarity map';
    this.bar.hidden = !fitting;
    this.message(task);
    this.progress(task);
  }

  message(task) {
    const waiting = this.model.analysisBusy ? 'Another analysis is running.' : '';
    this.status.textContent = task?.message ?? waiting;
    this.status.hidden = !this.status.textContent;
    this.status.classList.toggle('error', Boolean(task?.error));
  }

  progress(task) {
    if (task?.total > 0) {
      this.bar.max = task.total;
      this.bar.value = Math.min(task.completed, task.total);
      this.status.textContent = `${task.message} · ${percent(task)}%`;
    } else { this.bar.removeAttribute('value'); }
  }

  destroy() { this.cleanup(); this.node.remove(); }
}
