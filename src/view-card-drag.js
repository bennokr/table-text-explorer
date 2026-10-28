import { pointerDrag } from './pointer-drag.js';
import { CARD_WIDTH, HANDLE } from './view-layout-math.js';

export class CardDrag {
  constructor(layout) { this.layout = layout; }

  bind(cards) {
    for (const card of cards) {
      if (card.grip.onpointerdown) { continue; }
      pointerDrag(card.grip, () => this.start(card.config.id));
    }
  }

  fits(id, group) {
    const count = group.filter(card => card.id !== id).length + 1;
    return count * CARD_WIDTH + (count - 1) * HANDLE <= this.layout.container.clientWidth + 1;
  }

  previous(id) {
    const index = this.layout.groups?.findIndex(group => group.some(card => card.id === id));
    const group = this.layout.groups?.[index - 1];
    return group && this.fits(id, group) ? group : null;
  }

  up(id) {
    const group = this.previous(id);
    if (group) { this.place(id, { group, index: group.length }); }
  }

  clear() {
    for (const row of this.layout.rows) {
      delete row.dataset.drop;
      row.style.removeProperty('--drop-x');
    }
  }

  target(event, id) {
    this.clear();
    const index = this.layout.rows.findIndex(row => {
      const box = row.getBoundingClientRect();
      return row.isConnected && event.clientY >= box.top && event.clientY <= box.bottom;
    });
    const group = this.layout.groups[index];
    if (!group) { return null; }
    const row = this.layout.rows[index];
    const box = row.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right) { return null; }
    row.dataset.drop = this.fits(id, group) ? 'valid' : 'full';
    if (!this.fits(id, group)) { return null; }
    return this.insertion(event.clientX, group, row, box);
  }

  insertion(x, group, row, box) {
    const position = group.findIndex(card => {
      const bounds = card.node.getBoundingClientRect();
      return x < bounds.left + bounds.width / 2;
    });
    const insertion = position < 0 ? group.length : position;
    const edge = group[insertion]?.node.getBoundingClientRect().left ?? box.right;
    row.style.setProperty('--drop-x', `${Math.max(0, Math.min(box.width - 3, edge - box.left))}px`);
    return { group, index: insertion };
  }

  start(id) {
    const card = this.layout.order.find(card => card.id === id);
    let target;
    card.node.classList.add('card-dragging');
    return {
      move: event => { target = this.target(event, id); },
      end: cancel => {
        card.node.classList.remove('card-dragging');
        this.clear();
        if (!cancel && target) { this.place(id, target); }
      },
    };
  }

  place(id, target) {
    const card = this.layout.order.find(card => card.id === id);
    const index = this.layout.groups.indexOf(target.group);
    if (index < 0) { return; }
    const groups = this.layout.groups.map(group => group.filter(item => item !== card));
    const before = target.group.slice(0, target.index).filter(item => item !== card).length;
    groups[index].splice(before, 0, card);
    this.layout.setGroups(groups);
  }
}
