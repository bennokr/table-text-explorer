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

function opposite(predicate) {
  return predicate.kind === 'not' ? predicate.child : { kind: 'not', child: predicate };
}

function withoutConjunct(query, predicate) {
  if (formatQuery(query) === formatQuery(predicate)) { return null; }
  if (query.kind !== 'and') { return query; }
  const [left, right] = [withoutConjunct(query.left, predicate), withoutConjunct(query.right, predicate)];
  if (!left || !right) { return left ?? right; }
  return { kind: 'and', left, right };
}

// Adding the same condition again changes nothing; adding its opposite replaces it (a flip).
export function appendPredicate(query, predicate) {
  if (!query) { return predicate; }
  if (hasConjunct(query, predicate)) { return query; }
  const flipped = hasConjunct(query, opposite(predicate)) ? withoutConjunct(query, opposite(predicate)) : query;
  return flipped ? { kind: 'and', left: flipped, right: predicate } : predicate;
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
