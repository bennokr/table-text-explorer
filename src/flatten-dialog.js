import { $, element } from './dom.js';
import { flatTable } from './flatten.js';

const SHOWN = 30;
const EXAMPLE_LENGTH = 40;

function columnRow(column) {
  const example = column.example.replaceAll('\n', ' ⏎ ');
  const short = example.length > EXAMPLE_LENGTH ? `${example.slice(0, EXAMPLE_LENGTH)}…` : example;
  return element('tr', {}, [element('th', { text: column.path, scope: 'row' }), element('td', { text: column.kind }),
    element('td', { text: column.filled }), element('td', { text: short })]);
}

function showPlan(table) {
  const { columns, skipped } = table.flattened;
  const left = skipped.length ? ` · ${skipped.length} left out` : '';
  $('#flatten-summary').textContent = `${table.rows.length} records · ${columns.length} columns${left}`;
  const hidden = columns.length - SHOWN;
  const more = hidden > 0 ? [element('tr', {}, [element('td', { text: `+ ${hidden} more`, colspan: 4 })])] : [];
  $('#flatten-columns').replaceChildren(...columns.slice(0, SHOWN).map(columnRow), ...more);
}

// Nested records ask first: flatten them, keep only their flat columns, or cancel the import. Returns the table to load, or null.
export function chooseFlattening(table) {
  if (!table.flattened) { return table; }
  const dialog = $('#flatten-dialog');
  showPlan(table);
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      if (dialog.returnValue === 'flatten') { resolve(flatTable(table)); }
      else { resolve(dialog.returnValue === 'skip' ? table : null); }
    }, { once: true });
    dialog.returnValue = '';
    dialog.showModal();
  });
}
