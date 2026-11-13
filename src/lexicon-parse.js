// Reading the lexicon files (src/lexicon/<code>/{stop,lead,negation,fold}.txt): plain text, one entry per line,
// # starts a comment. Kept apart from the bundling (src/lexicon.js) so it runs anywhere.
const lines = text => text.split('\n').map(line => line.replace(/#.*/u, '').trim()).filter(Boolean);

export function parseWords(text) { return lines(text).map(line => line.toLowerCase()); }

// Directives (`@name`) and rules (`suffix replacement minimum`, a replacement of - meaning nothing).
export function parseFold(text) {
  const spec = { collapse: false, undouble: false, dropE: false, rules: [] };
  for (const line of lines(text)) {
    if (line.startsWith('@')) { spec[line === '@drop-e' ? 'dropE' : line.slice(1)] = true; continue; }
    const [suffix, replacement, minimum] = line.split(/\s+/u);
    spec.rules.push([suffix, replacement === '-' ? '' : replacement, Number(minimum)]);
  }
  return spec;
}

const parsers = { stop: parseWords, lead: parseWords, negation: parseWords, fold: parseFold };

// { './lexicon/nl/stop.txt': text, ... } into { nl: { stop: [...], lead: [...], negation: [...], fold: {...} } }.
export function groupFiles(files) {
  const languages = {};
  for (const [path, text] of Object.entries(files)) {
    const [, code, kind] = /\/lexicon\/([^/]+)\/([^/.]+)\.txt$/u.exec(path) ?? [];
    if (parsers[kind]) { (languages[code] ??= {})[kind] = parsers[kind](text); }
  }
  return languages;
}

const union = (languages, codes, kind) => [...new Set(codes.flatMap(code => languages[code]?.[kind] ?? []))];

// What a language choice ("nl", "en", "nl,en" or "none") plus the user's own stopwords mean for phrase counting.
// With two languages the folding rules of the first are used: suffix rules of two languages would clash.
export function lexiconFrom(languages, { language, stopwords = '' }) {
  const codes = language.split(',').filter(code => languages[code]);
  const extra = stopwords.toLowerCase().split(/[\s,]+/u).filter(Boolean);
  return { stop: [...new Set([...union(languages, codes, 'stop'), ...extra])], lead: union(languages, codes, 'lead'),
    negation: union(languages, codes, 'negation'), fold: languages[codes[0]]?.fold ?? null };
}
