import { inferColumn } from 'linked-codebook';
import { dateNumber, temporal } from './dates.js';

export const missing = (value, field) => value === null || value === undefined || value === '' || value === '\\N'
  || Boolean(field?.missingValues?.some(code => String(value) === String(code.value ?? code)));
export const keyOf = (value, field) => missing(value, field) ? 'missing:' : `${typeof value}:${String(value)}`;
export const isIdentifier = name => /(^id$|^row.?number$|^resp?no$|_id$)/i.test(name);

// Low-cardinality text is far more likely to be categorical than low-cardinality numbers,
// so each data type has its own limit. Value labels count as evidence for either.
export const defaultLimits = Object.freeze({ text: 50, number: 8 });

export function categoryLimits(config = {}) {
  return { text: config.categoryLimit ?? defaultLimits.text,
    number: config.numericCategoryLimit ?? defaultLimits.number };
}

// The rules that decide the kind of a column live in linked-codebook. A column is a boolean, a date
// or a datetime by its datatype, and categorical or numeric by its level.
function kindOf(values, base, limits) {
  if (base.kind) { return base.kind; }
  if (!values.length) { return 'empty'; }
  const options = { identifier: base.identifier, labelled: base.valueLabels.length > 0, limits };
  const { datatype, level } = inferColumn(values, options);
  if (['boolean', 'date', 'datetime'].includes(datatype)) { return datatype; }
  if (level === 'categorical') { return 'categorical'; }
  return level === 'numerical' ? 'number' : 'text';
}

export function inferField(name, rows, metadata, limits = categoryLimits()) {
  const values = rows.map(row => row[name]).filter(value => !missing(value, metadata));
  const unique = [...new Map(values.map(value => [keyOf(value), value])).values()];
  const base = { ...metadata, name, unique, missing: rows.length - values.length, identifier: metadata?.identifier ?? isIdentifier(name),
    empty: !values.length, constant: unique.length === 1,
    storage: typeof values[0], label: metadata?.label, valueLabels: metadata?.valueLabels ?? [] };
  return { ...base, kind: kindOf(values, base, limits) };
}

export function inferSchema(rows, metadata = {}, config = {}) {
  const names = [...new Set(rows.flatMap(row => Object.keys(row)))];
  return names.map(name => {
    const field = inferField(name, rows, metadata[name], categoryLimits(config));
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
