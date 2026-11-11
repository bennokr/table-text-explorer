import { element } from './dom.js';
import { Events } from './events.js';

export function mountDensityControls(legend) {
  const method = element('select', { 'aria-label': 'Density cluster selection' }, [
    element('option', { value: 'eom', text: 'Stable groups' }),
    element('option', { value: 'leaf', text: 'Fine groups' })]);
  const epsilon = element('input', { type: 'number', min: '0', step: 'any',
    'aria-label': 'Minimum cluster separation' });
  const change = () => {
    if (!epsilon.reportValidity()) { return; }
    legend.model.densityRequest = { result: legend.result,
      selection: { method: method.value, epsilon: Number(epsilon.value) } };
    legend.model.emit(Events.DENSITY_SELECTION);
  };
  method.onchange = change;
  epsilon.onchange = change;
  legend.densityControls = { method, epsilon };
  legend.root.append(element('div', { class: 'cluster-cut density-controls' }, [method,
    element('label', { title: 'Merge nearby density branches below this distance. Zero keeps the original selection. Reuses the fitted tree.' },
      ['Min separation ', epsilon])]));
}

export function syncDensityControls(legend) {
  if (!legend.densityControls) { return; }
  for (const [key, input] of Object.entries(legend.densityControls)) {
    input.value = legend.result.selection[key];
    input.disabled = legend.model.analysisBusy;
  }
}
