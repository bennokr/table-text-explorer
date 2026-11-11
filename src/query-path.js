import { formatQuery, phrasePredicate } from './query-predicates.js';

// The query is a path: AND-ed conditions, one per click in a cloud or table. Everything here is pure.
export function conjuncts(ast) {
  if (!ast) { return []; }
  return ast.kind === 'and' ? [...conjuncts(ast.left), ...conjuncts(ast.right)] : [ast];
}

export function joinConjuncts(list) {
  return list.reduce((left, right) => (left ? { kind: 'and', left, right } : right), null);
}

export function negation(node) { return node.kind === 'not' ? node.child : { kind: 'not', child: node }; }

export function withoutConjunct(ast, index) {
  return joinConjuncts(conjuncts(ast).filter((_, position) => position !== index));
}

export function chipLabel(node) {
  if (node.kind === 'not') { return `NOT ${chipLabel(node.child)}`; }
  if (node.kind !== 'term') { return formatQuery(node); }
  const operator = node.op === '~' ? 'contains' : node.op;
  return `${node.field ?? 'any field'} ${operator} ${node.value}`;
}

const words = text => String(text).toLowerCase().split(/\s+/u).filter(Boolean);

function nested(outer, inner) {
  for (let start = 0; start + inner.length <= outer.length; start += 1) {
    if (inner.every((word, offset) => outer[start + offset] === word)) { return true; }
  }
  return false;
}

function samePhraseFamily(path, predicate) {
  if (path.kind !== 'term' || predicate.kind !== 'term' || path.op !== '~' || predicate.op !== '~') { return false; }
  if (path.field !== predicate.field) { return false; }
  const [left, right] = [words(path.value), words(predicate.value)];
  return nested(left, right) || nested(right, left);
}

// A conditioned cloud does not repeat the conditions themselves: the exact predicate, nested or
// containing phrases of a phrase condition, and the negation of either are all hidden.
export function coveredByPath(term, fieldName, path) {
  const predicate = term.predicate ?? phrasePredicate(term.field ?? fieldName, term.phrase);
  const key = formatQuery(predicate);
  return path.some(condition => {
    const target = condition.kind === 'not' ? condition.child : condition;
    return formatQuery(target) === key || samePhraseFamily(target, predicate);
  });
}
