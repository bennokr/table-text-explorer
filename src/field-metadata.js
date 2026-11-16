// Table Schema's logical types are separate from statistical/UI interpretation.
export function fieldDescription(field) {
  return [field.description, field.label, field.title, field.name]
    .map(value => String(value ?? '').trim().replace(/\s+/gu, ' ')).find(Boolean) ?? '';
}

export function schemaMetadata(schema, existing = {}) {
  const entries = schema.fields.map(field => {
    const base = existing[field.name] ?? {};
    const metadata = fieldMetadata(field, base);
    metadata.identifier = Boolean(extension(field).identifying) || base.identifier;
    metadata.missingValues = field.missingValues ?? schema.missingValues ?? [''];
    return [field.name, metadata];
  });
  return { ...existing, ...Object.fromEntries(entries) };
}

// Slots that Table Schema has no property for are kept by linked-codebook under this key.
const extension = field => field['x-linked-codebook'] ?? {};
const numeric = type => ['integer', 'number', 'year'].includes(type);
const typed = (code, type) => numeric(type) && code.trim() !== '' && Number.isFinite(Number(code)) ? Number(code) : code;

// Labelled codes of a closed list are `categories`; a partial list stays in the extension and does not imply that
// other values are invalid.
function valueLabels(field, base) {
  const closed = field.categories?.filter(value => typeof value === 'object');
  const listed = (extension(field).values ?? []).filter(value => value.label && !value.missing)
    .map(value => ({ value: typed(value.code, field.type), label: value.label }));
  return closed ?? (listed.length ? listed : base.valueLabels ?? []);
}

function fieldMetadata(field, base) {
  return { ...base, ...field, label: field.title ?? base.label, kind: fieldKind(field) ?? base.kind,
    group: extension(field).group ?? base.group, language: extension(field).language ?? base.language,
    valueLabels: valueLabels(field, base) };
}

function fieldKind(field) {
  const kinds = { string: 'text', integer: 'number', number: 'number', year: 'number',
    boolean: 'boolean', date: 'date', datetime: 'datetime' };
  if (extension(field).identifying) { return kinds[field.type]; }
  if (field.categories || ['categorical', 'nominal', 'ordinal'].includes(extension(field).level)) { return 'categorical'; }
  return kinds[field.type];
}
