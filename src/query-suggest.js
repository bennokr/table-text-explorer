import { categorical, categoryLabel, missing } from './schema.js';

const MAX_ITEMS = 12;
const KINDS = { categorical: 'category', boolean: 'yes / no', number: 'number', date: 'date', datetime: 'date', text: 'text' };
const OPERATORS = {
  categorical: [['=', 'is'], ['!=', 'is not']],
  number: [['=', 'equals'], ['>', 'more than'], ['>=', 'at least'], ['<', 'less than'], ['<=', 'at most'], ['!=', 'is not']],
  text: [['~', 'contains the phrase'], [':', 'contains']],
};
const VALUE = /(?<field>"[^"]+"|[^\s():=<>~!"']+)\s*(?<op>>=|<=|!=|[:=<>~])\s*(?<value>"[^"]*|[^\s()"']*)$/u;
const OPERATOR = /(?<field>"[^"]+"|[^\s():=<>~!"']+)\s+(?<op>>=|<=|!=|[<>:=~]|!)?$/u;
const FIELD = /(?<prefix>"[^"]*|[^\s():=<>~!"']*)$/u;

const bare = name => name.replace(/^"|"$/gu, '');
const quoted = value => (/^[^\s():=<>~!"']+$/u.test(value) ? value : JSON.stringify(value));
function operatorKind(field) {
  if (categorical(field)) { return 'categorical'; }
  return ['number', 'date', 'datetime'].includes(field.kind) ? 'number' : 'text';
}

function slotOf(draft) {
  const value = VALUE.exec(draft);
  // "year >" may still become ">=": a lone < or > with nothing after it is a partial operator.
  const partial = value && !value.groups.value && ['<', '>'].includes(value.groups.op) && !/\s$/u.test(draft);
  if (value && !partial) { return { kind: 'value', ...value.groups }; }
  const operator = partial ? VALUE.exec(draft) : OPERATOR.exec(draft);
  if (operator) { return { kind: 'operator', ...operator.groups }; }
  return { kind: 'field', prefix: FIELD.exec(draft).groups.prefix };
}

const fieldNamed = (model, name) => model.fields.find(field => field.name.toLowerCase() === bare(name).toLowerCase());

function fieldItems(model, draft, slot) {
  const prefix = bare(slot.prefix).toLowerCase();
  const head = draft.slice(0, draft.length - slot.prefix.length);
  return model.fields.filter(field => field.kind !== 'empty' && field.name.toLowerCase().includes(prefix))
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(prefix)) - Number(a.name.toLowerCase().startsWith(prefix)))
    .map(field => ({ label: field.name, hint: KINDS[field.kind] ?? field.kind, draft: `${head}${quoted(field.name)} ` }));
}

function operatorItems(model, draft, slot) {
  const field = fieldNamed(model, slot.field);
  if (!field) { return []; }
  const head = draft.slice(0, draft.length - (slot.op ?? '').length);
  return OPERATORS[operatorKind(field)].filter(([op]) => op.startsWith(slot.op ?? ''))
    .map(([op, label]) => ({ label: op, hint: label, draft: `${head}${op}` }));
}

const counts = new Map();

// How often each value occurs, remembered per table revision so a keystroke does not recount the table.
function valueCounts(model, field) {
  const key = `${model.revision}:${field.name}`;
  if (!counts.has(key)) {
    const tally = new Map();
    for (const row of model.rows) {
      if (!missing(row[field.name], field)) { tally.set(row[field.name], (tally.get(row[field.name]) ?? 0) + 1); }
    }
    counts.set(key, [...tally].sort((a, b) => b[1] - a[1]));
    for (const old of [...counts.keys()].filter(name => !name.startsWith(`${model.revision}:`))) { counts.delete(old); }
  }
  return counts.get(key);
}

// Words that occur in many records of a text column, for completing a phrase.
function frequentWords(model, field) {
  const key = `${model.revision}:${field.name}:words`;
  if (!counts.has(key)) {
    const tally = new Map();
    for (const value of (field.unique ?? []).slice(0, 2000)) {
      for (const word of new Set(String(value).toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])) { tally.set(word, (tally.get(word) ?? 0) + 1); }
    }
    counts.set(key, [...tally].sort((a, b) => b[1] - a[1]).slice(0, 500));
  }
  return counts.get(key);
}

function valuePool(model, field) {
  if (categorical(field)) { return valueCounts(model, field); }
  return field.kind === 'text' ? frequentWords(model, field) : [];
}

function nullItem(field, typed, head) {
  const offered = field.missing > 0 && 'null'.startsWith(typed);
  return offered ? [{ label: 'null', hint: `${field.missing} missing`, draft: `${head}null`, done: true }] : [];
}

function valueItems(model, draft, slot) {
  const field = fieldNamed(model, slot.field);
  if (!field) { return { items: [] }; }
  const typed = slot.value.replace(/^"/u, '').toLowerCase();
  const head = draft.slice(0, draft.length - slot.value.length);
  const pool = valuePool(model, field);
  const items = pool.filter(([value]) => String(value).toLowerCase().includes(typed)).slice(0, MAX_ITEMS)
    .map(([value, count]) => ({ label: categoryLabel(value, field), hint: `${count} records`, draft: `${head}${quoted(String(value))}`, done: true }));
  const all = [...items, ...nullItem(field, typed, head)];
  return { items: all, message: all.length || pool.length ? '' : `Type a ${KINDS[field.kind] ?? 'value'}, then press Enter.` };
}

// What to offer for the draft being typed: columns first, then the operators that fit the column's type,
// then its values. `done` marks a suggestion that completes a condition, ready to become a chip.
export function suggest(model, draft) {
  const slot = slotOf(draft);
  if (slot.kind === 'value') { return valueItems(model, draft, slot); }
  if (slot.kind === 'operator') { return { items: operatorItems(model, draft, slot) }; }
  return { items: fieldItems(model, draft, slot).slice(0, MAX_ITEMS), more: Math.max(0, fieldItems(model, draft, slot).length - MAX_ITEMS) };
}
