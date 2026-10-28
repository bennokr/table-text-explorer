// A table column has scalar cells. Nested JSON needs an explicit flattening step.
export function scalarColumns(rows) {
  const ignored = new Set();
  for (const row of rows) {
    for (const [name, value] of Object.entries(row)) {
      if (value !== null && typeof value === 'object') { ignored.add(name); }
    }
  }
  if (!ignored.size) { return { rows, ignoredFields: [] }; }
  return { rows: rows.map(row => Object.fromEntries(Object.entries(row).filter(([name]) => !ignored.has(name)))),
    ignoredFields: [...ignored] };
}
