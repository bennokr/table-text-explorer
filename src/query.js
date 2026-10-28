import { missing, numberOf } from './schema.js';

function tokenize(input) {
  const pattern = /\s*(>=|<=|!=|[():=<>~]|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s():=<>~!"']+)\s*/gy;
  const tokens = [];
  let cursor = 0;
  while (cursor < input.trimEnd().length) {
    pattern.lastIndex = cursor;
    const match = pattern.exec(input);
    if (!match) { throw new Error(`Unexpected character at ${cursor + 1}.`); }
    tokens.push(match[1]);
    cursor = pattern.lastIndex;
  }
  return tokens;
}

function unquote(value) {
  if (value.startsWith('"')) {
    try { return JSON.parse(value); } catch { /* Retain existing permissive escaping. */ }
  }
  if (/^["']/.test(value)) { return value.slice(1, -1).replace(/\\([\\"'])/g, '$1'); }
  return value;
}

class Parser {
  constructor(input) { this.tokens = tokenize(input); this.position = 0; }
  peek() { return this.tokens[this.position]?.toUpperCase(); }
  take() { return this.tokens[this.position++]; }

  or() {
    let left = this.and();
    while (this.peek() === 'OR') {
      this.take();
      left = { kind: 'or', left, right: this.and() };
    }
    return left;
  }

  and() {
    let left = this.atom();
    while (this.peek() && !['OR', ')'].includes(this.peek())) {
      if (this.peek() === 'AND') { this.take(); }
      left = { kind: 'and', left, right: this.atom() };
    }
    return left;
  }

  atom() {
    const token = this.take();
    if (!token || ['AND', 'OR', ')'].includes(token.toUpperCase())) {
      throw new Error('Expected a search term.');
    }
    if (token.toUpperCase() === 'NOT') { return { kind: 'not', child: this.atom() }; }
    if (token === '(') {
      const expression = this.or();
      if (this.take() !== ')') { throw new Error('Close the parenthesis.'); }
      return expression;
    }
    if ([':', '~', '=', '!=', '>', '>=', '<', '<='].includes(this.peek())) { return this.term(token); }
    return { kind: 'term', field: null, op: ':', value: unquote(token) };
  }

  term(token) {
    const op = this.take();
    const value = this.take();
    if (!value || ['(', ')', 'AND', 'OR'].includes(value.toUpperCase())) {
      throw new Error('Expected a value after the field operator.');
    }
    const term = { kind: 'term', field: unquote(token), op, value: unquote(value) };
    if (op !== '~' && /^["']null["']$/i.test(value)) { term.literal = true; }
    return term;
  }
}

function numericComparison(value, term, field) {
  const number = numberOf(value, field);
  const target = numberOf(term.value, field);
  const comparisons = { '>': number > target, '>=': number >= target,
    '<': number < target, '<=': number <= target };
  return comparisons[term.op];
}

function textComparison(value, term) {
  const needle = term.value.toLocaleLowerCase();
  const text = missing(value) ? '' : String(value).toLocaleLowerCase();
  if (term.op === '!=') { return text !== needle; }
  if (term.op === '=') { return text === needle; }
  if (needle.endsWith('*')) { return text.split(/\s+/u).some(word => word.startsWith(needle.slice(0, -1))); }
  return text.includes(needle);
}

function compare(value, term, field) {
  if (term.value.toLowerCase() === 'null' && term.field && !term.literal && term.op !== '~') {
    return term.op === '!=' ? !missing(value, field) : missing(value, field);
  }
  if (missing(value, field)) { return false; }
  if (['>', '>=', '<', '<='].includes(term.op)) { return numericComparison(value, term, field); }
  return textComparison(value, term);
}

function resolveField(name, fields) {
  const exact = fields.find(field => field.name === name);
  if (exact) { return exact; }
  const matches = fields.filter(field => field.name.toLowerCase() === name.toLowerCase());
  if (!matches.length) { throw new Error(`Unknown column: ${name}`); }
  if (matches.length > 1) { throw new Error(`Ambiguous column: ${name}. Match its exact case.`); }
  return matches[0];
}

function compile(node, fields, context) {
  if (node.kind === 'and') {
    const left = compile(node.left, fields, context), right = compile(node.right, fields, context);
    return row => left(row) && right(row);
  }
  if (node.kind === 'or') {
    const left = compile(node.left, fields, context), right = compile(node.right, fields, context);
    return row => left(row) || right(row);
  }
  if (node.kind === 'not') { const child = compile(node.child, fields, context); return row => !child(row); }
  return compileTerm(node, fields, context);
}

function compileTerm(node, fields, context) {
  if (node.field === null) { return row => Object.values(row).some(value => compare(value, node, null)); }
  const field = resolveField(node.field, fields);
  if (node.op === '~') {
    if (!context?.phrase) { throw new Error('Exact phrase queries require prepared matches.'); }
    return context.phrase(field, node.value);
  }
  if (['>', '>=', '<', '<='].includes(node.op) && !Number.isFinite(numberOf(node.value, field))) {
    throw new Error(`Expected a numeric or date value for ${field.name}.`);
  }
  return row => compare(row[field.name], node, field);
}

export function parseQuery(input, fields, context) {
  if (!input.trim()) { return { ast: null, test: () => true }; }
  const parser = new Parser(input);
  const ast = parser.or();
  if (parser.position !== parser.tokens.length) { throw new Error('Unexpected closing parenthesis.'); }
  return { ast, test: compile(ast, fields, context) };
}
