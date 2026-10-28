import { findVariables, selectionSummary } from './variable-options.js';
import { pickerControls, renderPicker, pickerKey } from './variable-picker-dom.js';

export class VariablePicker extends HTMLElement {
  static observedAttributes = ['multiple', 'disabled', 'aria-label', 'caption', 'title'];
  _variables = [];
  _selected = [];
  selectedOnly = false;

  get variables() { return this._variables; }
  set variables(value) {
    this._variables = value;
    const available = new Set(value.map(variable => variable.id));
    this._selected = this._selected.filter(id => available.has(id));
    this.update();
  }

  get selected() { return [...this._selected]; }
  set selected(value) {
    const available = new Set(this.variables.map(variable => variable.id));
    this._selected = [...new Set(value)].filter(id => available.has(id));
    if (!this.multiple) { this._selected = this._selected.slice(0, 1); }
    this.update();
  }

  get multiple() { return this.hasAttribute('multiple'); }
  set multiple(value) { this.toggleAttribute('multiple', Boolean(value)); }
  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(value) { this.toggleAttribute('disabled', Boolean(value)); }

  connectedCallback() {
    if (!this.controls) { this.mount(); }
    this.update();
  }

  disconnectedCallback() { this.close(false); }
  attributeChangedCallback(name) {
    if (name === 'multiple' && !this.multiple) {
      this._selected = this._selected.slice(0, 1);
      this.selectedOnly = false;
    }
    this.update();
  }

  mount() {
    this.controls = pickerControls(this);
    const { trigger, panel, search, type, selectedOnly, bulk } = this.controls;
    this.append(trigger, panel);
    trigger.onclick = () => this.open();
    search.oninput = event => { event.stopPropagation(); this.render(); };
    type.onchange = event => { event.stopPropagation(); this.render(); };
    selectedOnly.onclick = () => { this.selectedOnly = !this.selectedOnly; this.render(); };
    bulk.onclick = () => this.chooseGroup(this.matches());
    panel.onkeydown = event => pickerKey(this, event);
    // Internal native changes (including search-on-blur) are not selections.
    panel.onchange = event => event.stopPropagation();
    panel.oninput = event => event.stopPropagation();
    panel.addEventListener('toggle', () => trigger.setAttribute('aria-expanded', String(panel.matches(':popover-open'))));
  }

  update() {
    if (!this.controls) { return; }
    const { trigger, panel } = this.controls;
    const label = this.getAttribute('aria-label') || 'Choose variables';
    const summary = selectionSummary(this.variables, this.selected, this.multiple);
    const caption = this.getAttribute('caption');
    trigger.textContent = caption ? `${caption} · ${summary}` : summary;
    trigger.title = this.title || summary;
    trigger.setAttribute('aria-label', label);
    panel.setAttribute('aria-label', label);
    trigger.disabled = this.disabled;
    if (this.disabled) { this.close(false); }
    if (panel.matches(':popover-open')) { this.render(); }
  }

  open() {
    const { panel, trigger, search } = this.controls;
    if (this.disabled || trigger.matches(':disabled')) { return; }
    if (panel.matches(':popover-open')) { this.close(true); return; }
    panel.showPopover();
    const box = trigger.getBoundingClientRect();
    const width = Math.min(440, window.innerWidth - 16);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - width - 8))}px`;
    const below = window.innerHeight - box.bottom - 8;
    const height = Math.min(460, Math.max(below, box.top - 8));
    panel.style.maxHeight = `${height}px`;
    panel.style.top = `${below >= height ? box.bottom + 3 : Math.max(8, box.top - height)}px`;
    this.render();
    search.focus();
    search.select();
  }

  close(focus) {
    if (!this.controls?.panel.matches(':popover-open')) { return; }
    this.controls.panel.hidePopover();
    this.controls.trigger.setAttribute('aria-expanded', 'false');
    if (focus) { this.controls.trigger.focus(); }
  }

  matches() {
    return findVariables(this.variables, this.controls.search.value, this.controls.type.value,
      this.selectedOnly, new Set(this.selected));
  }

  render() {
    const type = this.controls.type;
    if (!this.variables.some(variable => variable.type === type.value)) { type.value = ''; }
    renderPicker(this, this.matches());
  }

  choose(id) {
    if (!this.multiple) { this.commit([id]); this.close(true); return; }
    const selected = new Set(this.selected);
    if (selected.has(id)) { selected.delete(id); } else { selected.add(id); }
    this.commit([...selected]);
  }

  chooseGroup(variables) {
    const selected = new Set(this.selected);
    const remove = variables.every(variable => selected.has(variable.id));
    for (const variable of variables) {
      if (remove) { selected.delete(variable.id); } else { selected.add(variable.id); }
    }
    this.commit([...selected]);
  }

  commit(selected) {
    this.selected = selected;
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { selected: this.selected } }));
  }
}

customElements.define('variable-picker', VariablePicker);
