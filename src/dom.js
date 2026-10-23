export const $ = selector => document.querySelector(selector);

export function element(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'text') { node.textContent = value; }
    else if (key.startsWith('on')) { node.addEventListener(key.slice(2), value); }
    else { node.setAttribute(key, value); }
  }
  node.append(...children);
  return node;
}

export function options(select, entries, value) {
  select.replaceChildren(...entries.map(([key, label]) => new Option(label, key)));
  if (entries.some(([key]) => key === value)) { select.value = value; }
}

export function glyph(text, label, action) {
  return element('button', { type: 'button', text, title: label, 'aria-label': label,
    onclick: action });
}

export function display(value) {
  if (value === null || value === undefined || value === '') { return '—'; }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
