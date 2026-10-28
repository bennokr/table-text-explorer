// Pixel preferences survive reflow; fitted widths fill the available row.
export const CARD_WIDTH = 280;
export const ROW_HEIGHT = 180;
export const HANDLE = 6;

export function packRows(cards, width, breaks) {
  const rows = [];
  let row = [];
  let used = 0;
  for (const card of cards) {
    const wanted = Math.min(width, CARD_WIDTH);
    if (row.length && (breaks.has(card.id) || used + HANDLE + wanted > width + 1)) {
      rows.push(row);
      row = [];
      used = 0;
    }
    used += wanted + (row.length ? HANDLE : 0);
    row.push(card);
  }
  if (row.length) { rows.push(row); }
  return rows;
}

export function fittedWidths(row, width, widths) {
  const available = Math.max(0, width - HANDLE * (row.length - 1));
  const minimum = Math.min(CARD_WIDTH, available / row.length);
  const weights = row.map(card => Math.max(0, (widths.get(card.id) ?? CARD_WIDTH) - CARD_WIDTH));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(weight => minimum + (available - minimum * row.length) * (total ? weight / total : 1 / row.length));
}

export function fittedHeight(height, count) {
  return Math.max(ROW_HEIGHT, (height - HANDLE * (count - 1)) / count);
}

export function snappedHeight(value, fitted) {
  return Math.max(ROW_HEIGHT, Math.abs(value - fitted) < 16 ? fitted : value);
}
