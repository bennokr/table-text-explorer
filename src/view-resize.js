import { CARD_WIDTH } from './view-layout-math.js';

export function resizeCards(layout, group, index) {
  const left = group[index - 1];
  const right = group[index];
  const original = new Map(layout.widths);
  const a = left.node.getBoundingClientRect().width;
  const b = right.node.getBoundingClientRect().width;
  group.forEach(card => layout.widths.set(card.id, card.node.getBoundingClientRect().width));
  const pending = { group, groups: layout.groups, sizes: new Map(group.map(card => [card.id, layout.widths.get(card.id)])) };
  layout.resizing = pending;
  const change = delta => {
    pending.card = null;
    if (Math.min(a + delta, b - delta) < CARD_WIDTH) {
      pending.card = delta < 0 ? left : right;
    }
    const shift = Math.max(-a, Math.min(b, delta));
    pending.sizes.set(left.id, a + shift);
    pending.sizes.set(right.id, b - shift);
    layout.widths.set(left.id, a + shift);
    layout.widths.set(right.id, b - shift);
    layout.schedule();
  };
  change.finish = cancel => {
    layout.resizing = null;
    if (cancel) { layout.widths = original; }
    else if (pending.card) { layout.pushCard(group, pending.card); }
    layout.schedule();
  };
  return change;
}
