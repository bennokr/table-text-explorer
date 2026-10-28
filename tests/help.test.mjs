import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { compileHelp } from '../src/help-markdown.js';

function assertLink(pages, link, current) {
  const [target, anchor] = link.split('#');
  const page = pages[target || current];
  assert.ok(page, link);
  if (anchor) { assert.ok(page.sections[anchor]?.summary, link); }
}

test('authored Markdown help has valid page/anchor links and contextual tooltip summaries', async () => {
  const directory = new URL('../docs/help/', import.meta.url);
  const files = await readdir(directory);
  const entries = await Promise.all(files.map(async name => [name.replace('.md', ''), compileHelp(await readFile(new URL(name, directory), 'utf8'))]));
  const pages = Object.fromEntries(entries);
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  for (const [name, page] of entries) {
    assert.ok(page.title && page.summary);
    const links = [...page.html.matchAll(/data-help="([^"]+)"/gu)].map(match => match[1]);
    for (const link of links) {
      assertLink(pages, link, name);
    }
  }
  for (const [, link] of html.matchAll(/data-help="([^"]+)"/gu)) {
    assertLink(pages, link);
  }
});

test('help escapes raw HTML and unsafe links, and folds technical sections using native details', () => {
  const result = compileHelp('# Test\n\nPlain summary.\n\n## Example\n\n**Bold** and `x<y` with [safe](maps.md).\n\n## Technical details\n\n<script>alert(1)</script> [unsafe](javascript:alert)\n\n### Formula\n\nA + B');
  assert.ok(result.html.includes('&lt;script&gt;'));
  assert.ok(!result.html.includes('href="javascript:'));
  assert.ok(result.html.includes('<details id="technical-details">'));
  assert.ok(result.html.includes('<code>x&lt;y</code>'));
  assert.equal(result.summary, 'Plain summary.');
  assert.equal(result.sections.formula.title, 'Formula');
});
