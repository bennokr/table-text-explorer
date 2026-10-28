import { dateNumber, dateKind, temporal } from './dates.js';

export const missing = (value, field) => value === null || value === undefined || value === '' || value === '\\N'
  || Boolean(field?.missingValues?.some(code => String(value) === String(code.value ?? code)));
export const keyOf = (value, field) => missing(value, field) ? 'missing:' : `${typeof value}:${String(value)}`;
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

function prose(value) {
  const text = String(value);
  return text.length > 80 || /[\r\n]/.test(text) || text.trim().split(/\s+/u).length > 7;
}

function stringCategory(values, count) {
  if (values.length < 3 || values.some(prose)) { return false; }
  return count < values.length && (count <= 8 || count / values.length <= 0.1);
}

function categoryEvidence(values, base) {
  const count = base.unique.length;
  if (base.valueLabels.length) { return true; }
  if (numeric(values)) {
    return values.every(value => Number.isInteger(Number(value))) && count <= 8 && count < values.length;
  }
  return stringCategory(values, count);
}

function lowCardinality(values, base, limit) {
  return !base.identifier && !sequential(values, base.unique) && base.unique.length <= limit
    && categoryEvidence(values, base);
}

function kindOf(values, base, limit) {
  if (base.kind) { return base.kind; }
  if (!values.length) { return 'empty'; }
  if (values.every(value => typeof value === 'boolean')) { return 'boolean'; }
  const dates = dateKind(values);
  if (dates) { return dates; }
  if (lowCardinality(values, base, limit)) { return 'categorical'; }
  return numeric(values) ? 'number' : 'text';
}

export function inferField(name, rows, metadata, limit) {
  const values = rows.map(row => row[name]).filter(value => !missing(value, metadata));
  const unique = [...new Map(values.map(value => [keyOf(value), value])).values()];
  const base = { ...metadata, name, unique, missing: rows.length - values.length, identifier: metadata?.identifier ?? isIdentifier(name),
    empty: !values.length, constant: unique.length === 1,
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
  if (missing(value, field)) { return NaN; }
  if (temporal(field)) { return dateNumber(value, field.format); }
  const result = Number(value);
  return Number.isFinite(result) ? result : NaN;
}

export function categoryLabel(value, field) {
  if (missing(value, field)) { return '(missing)'; }
  const entry = field.valueLabels.find(pair => pair.value === value);
  return entry ? `${value} · ${entry.label}` : String(value);
}

export const categorical = field => ['categorical', 'boolean'].includes(field.kind);
