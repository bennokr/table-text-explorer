import { parseQuery } from './query.js';
import { conjuncts } from './query-path.js';

// The query field holds conditions (chips) and a draft being typed. Together they are one query text:
// every chip is AND-ed, and a draft is parenthesised so an OR inside it cannot reach the chips.
export function composeQuery(chips, draft) {
  const text = draft.trim();
  if (!chips.length) { return text; }
  return text ? `${chips.join(' AND ')} AND (${text})` : chips.join(' AND ');
}

const quiet = { phrase: () => () => false };

// Splits a query text into conditions, one per top-level AND. Text that does not parse stays a draft.
export function splitQuery(text, fields) {
  if (!text.trim()) { return { nodes: [], draft: '' }; }
  try {
    const { ast } = parseQuery(text, fields, quiet);
    return { nodes: conjuncts(ast), draft: '' };
  } catch { return { nodes: [], draft: text }; }
}
