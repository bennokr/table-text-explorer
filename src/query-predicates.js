// Descriptions carry ordinary filter AST nodes. Facets/rules can compose
// these with AND/OR rather than keeping a separate matching representation.
export function phrasePredicate(field, phrase) {
  return { kind: 'term', field, op: '~', value: phrase };
}

export function valuePredicate(field, value) {
  const node = { kind: 'term', field, op: '=', value: String(value) };
  if (node.value.toLowerCase() === 'null') { node.literal = true; }
  return node;
}

export function missingPredicate(field) { return { kind: 'term', field, op: '=', value: 'null' }; }

export function rangePredicate(field, lower, upper) {
  const bound = (op, value) => ({ kind: 'term', field, op, value: String(value) });
  if (lower === null) { return bound('<=', upper); }
  if (upper === null) { return bound('>', lower); }
  return { kind: 'and', left: bound('>', lower), right: bound('<=', upper) };
}

function hasConjunct(query, predicate) {
  if (formatQuery(query) === formatQuery(predicate)) { return true; }
  return query.kind === 'and' && (hasConjunct(query.left, predicate) || hasConjunct(query.right, predicate));
}

export function appendPredicate(query, predicate) {
  if (!query) { return predicate; }
  if (hasConjunct(query, predicate)) { return query; }
  return { kind: 'and', left: query, right: predicate };
}

function queryValue(node) {
  const isMissing = node.field !== null && node.op !== '~' && node.value.toLowerCase() === 'null' && !node.literal;
  return isMissing ? 'null' : JSON.stringify(node.value);
}

export function formatQuery(node) {
  if (!node) { return ''; }
  if (node.kind === 'not') { return `NOT (${formatQuery(node.child)})`; }
  if (['and', 'or'].includes(node.kind)) {
    return `(${formatQuery(node.left)} ${node.kind.toUpperCase()} ${formatQuery(node.right)})`;
  }
  if (node.kind !== 'term') { throw new Error('Unsupported query predicate.'); }
  const value = queryValue(node);
  return node.field === null ? value : `${JSON.stringify(node.field)}${node.op}${value}`;
}
