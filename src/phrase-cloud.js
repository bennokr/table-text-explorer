import cloud from 'd3-cloud';
import { element } from './dom.js';

export function cloudWords(terms, ranking) {
  const minimum = Math.min(0, ...terms.map(term => term[ranking]));
  const maximum = Math.max(0, ...terms.map(term => term[ranking] - minimum));
  return terms.map(term => ({ text: term.phrase, term,
    size: maximum ? 12 + 16 * Math.log1p(9 * (term[ranking] - minimum) / maximum) / Math.log(10) : 20 }));
}

function svgElement(tag, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) { node.setAttribute(key, value); }
  return node;
}

function phraseText(word, tooltip, show) {
  const text = svgElement('text', { x: word.x, y: word.y, 'font-size': word.size,
    'text-anchor': 'middle', role: 'button', tabindex: 0, 'aria-label': word.term.field ? `${word.term.field}: ${word.text}` : word.text,
    'data-term': word.text, ...(word.term.color ? { style: `fill: ${word.term.color}`, 'data-field': word.term.field } : {}) });
  text.textContent = word.text;
  const title = svgElement('title', {});
  title.textContent = tooltip(word.term);
  text.append(title);
  text.onclick = () => show(word.term);
  text.onkeydown = event => {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); show(word.term); }
  };
  return text;
}

function paint(root, words, placed, width, { tooltip, show }) {
  const top = Math.min(0, ...placed.map(word => word.y + word.y0)) - 3;
  const bottom = Math.max(0, ...placed.map(word => word.y + word.y1)) + 3;
  const svg = svgElement('svg', { width, height: bottom - top, viewBox: `${-width / 2} ${top} ${width} ${bottom - top}` });
  svg.append(...placed.map(word => phraseText(word, tooltip, show)));
  const packed = new Set(placed.map(word => word.term));
  const missing = words.filter(word => !packed.has(word.term));
  root.replaceChildren(svg);
  if (missing.length) {
    root.append(element('small', { text: 'More phrases:' }), element('div', { class: 'cloud-overflow' },
      missing.map(word => element('button', { type: 'button', text: word.text, 'data-term': word.text,
        title: tooltip(word.term), style: `color: ${word.term.color ?? 'inherit'}`,
        'aria-label': word.term.field ? `${word.term.field}: ${word.text}` : word.text,
        onclick: () => show(word.term) }))));
  }
  root.setAttribute('aria-busy', 'false');
}

function fitWords(words, width) {
  const context = document.createElement('canvas').getContext('2d');
  return words.map(word => {
    context.font = `${word.size + 1}px sans-serif`;
    const size = Math.max(8, Math.min(word.size, word.size * (width - 48) / context.measureText(word.text).width));
    return { ...word, size };
  });
}

export function phraseCloud(terms, ranking, tooltip, show) {
  const root = element('div', { class: 'term-cloud', 'aria-busy': 'true', text: 'Preparing cloud…', 'aria-label': 'Phrase cloud; sizes use a logarithmic ranking scale within this cloud' });
  const words = cloudWords(terms, ranking);
  let layout, lastWidth = 0;
  const pack = (width, attempt = 0) => {
    root.setAttribute('aria-busy', 'true');
    const height = Math.min(300, Math.max(96, words.reduce((area, word) => area + word.text.length * word.size ** 2, 0) / width)) + attempt * 96;
    layout = cloud().size([width, Math.ceil(height)]).words(fitWords(words, width)).font('sans-serif')
      .fontSize(word => word.size).rotate(0).padding(2).random(() => 0.5).timeInterval(8)
      .on('end', placed => {
        if (!root.isConnected) { return; }
        if (placed.length < words.length && attempt < 2) { pack(width, attempt + 1); return; }
        paint(root, words, placed, width, { tooltip, show });
      });
    layout.start();
  };
  const observer = new ResizeObserver(([entry]) => {
    if (!root.isConnected) { root.dispose(); return; }
    // d3-cloud stores collision-board rows in 32-bit words.
    const width = Math.floor(entry.contentRect.width / 32) * 32;
    if (!width) { layout?.stop(); lastWidth = 0; return; }
    if (width === lastWidth) { return; }
    layout?.stop();
    lastWidth = width;
    pack(width);
  });
  root.dispose = () => { observer.disconnect(); layout?.stop(); };
  observer.observe(root);
  return root;
}
