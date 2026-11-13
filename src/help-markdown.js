// Deliberately small Markdown subset for bundled, authored help. HTML is escaped.
const escapeHelp = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const helpAnchor = text => text.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');

function inlineToken(token) {
  if (token.startsWith('`')) { return `<code>${escapeHelp(token.slice(1, -1))}</code>`; }
  if (token.startsWith('**')) { return `<strong>${escapeHelp(token.slice(2, -2))}</strong>`; }
  const link = /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(token);
  if (!link) { return escapeHelp(token); }
  const target = link[2].replace('.md', '');
  if (!/^(?:[a-z][a-z0-9-]*)?(?:#[a-z0-9-]+)?$/u.test(target) || !target) { return escapeHelp(link[1]); }
  return `<a href="${escapeHelp(link[2])}" data-help="${target}">${escapeHelp(link[1])}</a>`;
}

function inline(text) {
  return text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/u).map(inlineToken).join('');
}

function paragraph(block) {
  if (block.startsWith('```')) { return `<pre><code>${escapeHelp(block.replace(/^```[^\n]*\n|\n```$/gu, ''))}</code></pre>`; }
  const lines = block.split('\n');
  if (lines.every(line => /^[-*] /u.test(line))) {
    return `<ul>${lines.map(line => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
  }
  if (lines.every(line => /^\d+\. /u.test(line))) {
    return `<ol>${lines.map(line => `<li>${inline(line.replace(/^\d+\. /u, ''))}</li>`).join('')}</ol>`;
  }
  return `<p>${inline(lines.join(' '))}</p>`;
}

// The tooltip of a help button: the first sentence of the text, without Markdown. Whatever else there is to
// say belongs on the help page itself; tests keep these short.
function leadSentence(block, fallback) {
  const line = block?.split('\n')[0] ?? '';
  if (!line || /^([-*] |\d+\. |```|#)/u.test(line)) { return fallback; }
  const plain = line.replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1').replace(/\*\*([^*]+)\*\*/gu, '$1').replace(/`([^`]+)`/gu, '$1');
  return /^.+?[.!?](?=\s+[A-Z(]|$)/u.exec(plain)?.[0] ?? plain;
}

export function compileHelp(source) {
  const blocks = source.trim().split(/\n\s*\n/u);
  const title = blocks.shift().replace(/^# /u, '');
  const sections = {};
  const parts = [];
  let folded = false;
  blocks.forEach((block, index) => {
    const heading = /^(#{2,3}) (.+)$/u.exec(block);
    if (!heading) { parts.push(paragraph(block)); return; }
    if (folded && heading[1] === '##') { parts.push('</details>'); folded = false; }
    const anchor = helpAnchor(heading[2]);
    sections[anchor] = { title: heading[2], summary: leadSentence(blocks[index + 1], heading[2]) };
    if (heading[1] === '##' && ['settings', 'troubleshooting', 'technical-details'].includes(anchor)) {
      parts.push(`<details id="${anchor}"><summary>${inline(heading[2])}</summary>`);
      folded = true;
    } else { parts.push(`<h${heading[1].length} id="${anchor}">${inline(heading[2])}</h${heading[1].length}>`); }
  });
  if (folded) { parts.push('</details>'); }
  return { title, summary: leadSentence(blocks[0], title), sections, html: parts.join('\n') };
}
