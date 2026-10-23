import { readSav } from '@irbisadm/statfmt';

function equalCell(actual, expected) {
  if (actual === expected) { return true; }
  return typeof actual === 'number' && typeof expected === 'number' &&
    Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12;
}

function compare(dataset, expected) {
  const names = dataset.variables.map(variable => variable.name);
  const columnsMatch = JSON.stringify(names) === JSON.stringify(expected.columns);
  const valuesMatch = dataset.rows.length === expected.rows.length && dataset.rows.every((row, i) =>
    row.every((value, j) => equalCell(value, expected.rows[i][j])));
  const labelsMatch = dataset.variables.every(variable =>
    (variable.label || null) === expected.labels[variable.name]);
  const valueLabelsMatch = dataset.variables.every(variable => {
    const labels = Object.fromEntries((variable.valueLabels ?? []).map(pair => [pair.value, pair.label]));
    const reference = Object.entries(expected.value_labels[variable.name] ?? {});
    return Object.keys(labels).length === reference.length &&
      reference.every(([code, label]) => labels[Number(code)] === label);
  });
  const missingMatch = dataset.variables.every(variable => JSON.stringify(variable.missingRanges) ===
    JSON.stringify(expected.missing_ranges[variable.name] ?? []));
  return { columnsMatch, valuesMatch, labelsMatch, valueLabelsMatch, missingMatch,
    rows: dataset.rows.length };
}

export async function checkSavParity() {
  const response = await fetch('/reference/expected.json');
  if (!response.ok) { throw new Error('Run scripts/sav_reference.py first'); }
  const expected = await response.json();
  const results = {};
  for (const [name, path] of [['survey', '/fixtures/survey.sav'], ['edge', '/reference/edge.sav']]) {
    const bytes = new Uint8Array(await (await fetch(path)).arrayBuffer());
    results[name] = compare(readSav(bytes), expected[name]);
  }
  return results;
}
