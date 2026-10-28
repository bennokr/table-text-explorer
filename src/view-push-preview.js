import { element } from './dom.js';
import { packRows, ROW_HEIGHT } from './view-layout-math.js';

// Preview the same destination rows used on release, keeping an empty slot beside
// the captured divider. Original groups remain unchanged until the drag commits.
export function previewPush(layout, groups, width) {
  const pending = layout.resizing;
  if (!pending?.card) { layout.pushSlot = null; return { groups }; }
  if (!layout.pushSlot) {
    layout.pushSlot = element('div', { class: 'view-push-slot', 'data-pending-push': '' });
  }
  const index = groups.indexOf(pending.group);
  const next = groups[index + 1] ?? [];
  const destinations = packRows([pending.card, ...next], width, new Set());
  const displayed = [...groups];
  displayed.splice(index + 1, next.length ? 1 : 0, ...destinations);
  return { groups: displayed, source: pending.group, target: destinations[0], added: displayed.length > groups.length };
}

export function previewRow(row, group, preview, height) {
  row.classList.toggle('push-preview', group === preview.target);
  if (!preview.added && group === preview.source) {
    row.style.gridTemplateRows = `minmax(${Math.max(ROW_HEIGHT, height / 2)}px, auto)`;
  }
  if (!preview.added && group === preview.target) {
    row.style.gridTemplateRows = `minmax(${height * 2 - Math.max(ROW_HEIGHT, height / 2)}px, auto)`;
  }
}
