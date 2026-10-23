import { dateNumber } from './dates.js';

export const missing = value => value === null || value === undefined || value === '';
export const keyOf = value => missing(value) ? 'missing:' : `${typeof value}:${String(value)}`;
export const isIdentifier = name => /(^id$|^row.?number$|^resp?no$|_id$)/i.test(name);

function numeric(values) {
  return values.every(value => typeof value === 'number' ||
    (typeof value === 'string' && /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value)
      && !/^0\d+/.test(value))) && values.every(value => Number.isFinite(Number(value)));
}

function sequential(values, unique) {
  return values.length > 8 && unique.length === values.length &&
    values.every((value, index) => Number(value) === index + Number(values[0]));
}

function categoryEvidence(values, base) {
  const count = base.unique.length;
  if (base.valueLabels.length) { return true; }
  if (numeric(values)) {
    return values.every(value => Number.isInteger(Number(value))) && count <= 8 && count < values.length;
  }
  return count <= 8 || count / values.length <= 0.1;
}

function lowCardinality(values, base, limit) {
  return !base.identifier && !sequential(values, base.unique) && base.unique.length <= limit
    && categoryEvidence(values, base);
}

function kindOf(values, base, limit) {
  if (!values.length) { return 'empty'; }
  if (values.every(value => typeof value === 'boolean')) { return 'boolean'; }
  const dates = values.every(value => Number.isFinite(dateNumber(value)));
  if (dates) { return 'date'; }
  if (lowCardinality(values, base, limit)) { return 'categorical'; }
  return numeric(values) ? 'number' : 'text';
}

export function inferField(name, rows, metadata, limit) {
  const values = rows.map(row => row[name]).filter(value => !missing(value));
  const unique = [...new Map(values.map(value => [keyOf(value), value])).values()];
  const base = { name, unique, missing: rows.length - values.length, identifier: isIdentifier(name),
    storage: typeof values[0], label: metadata?.label, valueLabels: metadata?.valueLabels ?? [] };
  return { ...base, kind: kindOf(values, base, limit) };
}

export function inferSchema(rows, metadata = {}, config = {}) {
  const names = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return names.map(name => {
    const field = inferField(name, rows, metadata[name], config.categoryLimit ?? 50);
    const kind = config.overrides && Object.hasOwn(config.overrides, name) ? config.overrides[name] : field.kind;
    return { ...field, kind };
  });
}

export function numberOf(value, field) {
  if (missing(value)) { return NaN; }
  if (field?.kind === 'date') { return dateNumber(value); }
  const result = Number(value);
  return Number.isFinite(result) ? result : NaN;
}

export function categoryLabel(value, field) {
  if (missing(value)) { return '(missing)'; }
  const entry = field.valueLabels.find(pair => pair.value === value);
  return entry ? `${value} · ${entry.label}` : String(value);
}

export const categorical = field => ['categorical', 'boolean'].includes(field.kind);
