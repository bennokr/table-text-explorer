// Table Schema's logical types are separate from statistical/UI interpretation.
export function fieldDescription(field) {
  return [field.description, field.label, field.title, field.name]
    .map(value => String(value ?? '').trim().replace(/\s+/gu, ' ')).find(Boolean) ?? '';
}

export function schemaMetadata(schema, existing = {}) {
  const keys = [].concat(schema.primaryKey ?? []);
  const entries = schema.fields.map(field => {
    const base = existing[field.name] ?? {};
    const metadata = fieldMetadata(field, base);
    metadata.identifier = keys.includes(field.name) || field['x-role'] === 'identifier' || base.identifier;
    metadata.missingValues = field.missingValues ?? schema.missingValues ?? [''];
    return [field.name, metadata];
  });
  return { ...existing, ...Object.fromEntries(entries) };
}

function fieldMetadata(field, base) {
  const labels = field.categories?.filter(value => typeof value === 'object');
  return { ...base, ...field, label: field.title ?? base.label, kind: fieldKind(field) ?? base.kind,
    valueLabels: labels ?? field['x-valueLabels'] ?? base.valueLabels ?? [] };
}

function fieldKind(field) {
  const kinds = { string: 'text', integer: 'number', number: 'number', year: 'number',
    boolean: 'boolean', date: 'date', datetime: 'datetime' };
  if (field['x-role'] === 'identifier') { return kinds[field.type]; }
  if (field.categories || ['nominal', 'ordinal'].includes(field['x-measurement'])) { return 'categorical'; }
  return kinds[field.type];
}
