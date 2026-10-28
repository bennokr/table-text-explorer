import { $, options } from './dom.js';
import { compileHelp } from './help-markdown.js';

const sources = import.meta.glob('../docs/help/*.md', { query: '?raw', import: 'default', eager: true });
const pages = Object.fromEntries(Object.entries(sources).map(([path, source]) => [path.split('/').at(-1).replace('.md', ''), compileHelp(source)]));

export function bindHelp() {
  const dialog = $('#help-dialog');
  const content = $('#help-content');
  let history = [], cursor = -1, returnFocus;

  const render = () => {
    const entry = history[cursor];
    const [name, anchor] = entry.topic.split('#');
    const page = pages[name];
    $('#help-title').textContent = page.title;
    $('#help-topic').value = name;
    $('#help-back').disabled = cursor <= 0;
    $('#help-forward').disabled = cursor >= history.length - 1;
    content.innerHTML = page.html;
    const target = anchor ? content.querySelector(`#${CSS.escape(anchor)}`) : null;
    for (let parent = target; parent && parent !== content; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') { parent.open = true; }
    }
    content.scrollTop = entry.scroll ?? 0;
    if (target && entry.scroll === undefined) { target.scrollIntoView({ block: 'start' }); }
  };

  const open = topic => {
    const path = topic.startsWith('#') ? `${history[cursor]?.topic.split('#')[0] ?? 'start'}${topic}` : topic;
    if (!pages[path.split('#')[0]]) { return; }
    if (!dialog.open) { returnFocus = document.activeElement; history = []; cursor = -1; dialog.showModal(); }
    if (cursor >= 0) { history[cursor].scroll = content.scrollTop; }
    history = [...history.slice(0, cursor + 1), { topic: path }];
    cursor += 1;
    render();
  };

  const travel = offset => {
    history[cursor].scroll = content.scrollTop;
    cursor += offset;
    render();
  };
  options($('#help-topic'), Object.entries(pages).map(([name, page]) => [name, page.title]));
  $('#help-topic').onchange = event => open(event.target.value);
  $('#help-back').onclick = () => travel(-1);
  $('#help-forward').onclick = () => travel(1);
  dialog.addEventListener('close', () => { if (returnFocus?.isConnected) { returnFocus.focus(); } });
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-help]');
    if (trigger) { event.preventDefault(); open(trigger.dataset.help); }
  });
  for (const button of document.querySelectorAll('button[data-help]')) {
    const [name, anchor] = button.dataset.help.split('#');
    const info = pages[name].sections[anchor] ?? pages[name];
    button.title = info.summary;
    button.setAttribute('aria-label', `Help: ${info.title}`);
  }
}
