// UI-independent variable descriptors and search. No Dataset or analysis state.
export function variableOptions(fields, recordCount) {
  return fields.map(field => ({ id: field.name, label: field.name,
    description: [field.label ?? field.title, field.description].filter(Boolean).join(' · '),
    type: field.kind, group: field.group ?? '',
    nonMissing: recordCount - field.missing, missing: field.missing }));
}

function searchText(value) {
  return String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function findVariables(variables, query, type, selectedOnly, selected) {
  const words = searchText(query).split(/\s+/u).filter(Boolean);
  return variables.filter(variable => {
    if (type && variable.type !== type) { return false; }
    if (selectedOnly && !selected.has(variable.id)) { return false; }
    const text = searchText([variable.id, variable.label, variable.description, variable.group].join(' '));
    return words.every(word => text.includes(word));
  });
}

export function variableGroups(variables) {
  const groups = new Map();
  for (const variable of variables) {
    const group = variable.group || 'Variables';
    if (!groups.has(group)) { groups.set(group, []); }
    groups.get(group).push(variable);
  }
  return [...groups];
}

export function selectionSummary(variables, selected, multiple) {
  if (!selected.length) { return multiple ? 'No variables' : 'Choose variable…'; }
  if (selected.length > 1) { return `${selected.length} variables`; }
  const chosen = variables.find(variable => variable.id === selected[0]);
  return chosen?.label ?? selected[0];
}
