import { evaluateCondition, parseCondition } from 'linked-codebook';
import { missing } from './schema.js';

// What a cell means. A blank is `skipped` when the codebook's `applies_when` rule says the question was shown,
// `not_shown` when the rule says it was routed past, and `unknown` when there is no rule or it cannot be decided.
export const CELL = { answered: 'answered', skipped: 'asked_but_skipped', notShown: 'not_shown', unknown: 'unknown' };

function parseRule(field) {
  if (!field.appliesWhen) { return { none: true }; }
  try {
    return { condition: parseCondition(field.appliesWhen) };
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
}

// The row as a rule sees it: a blank or a declared missing code is no answer, so it becomes null.
function answers(row, fields) {
  return Object.fromEntries(fields.map(field => [field.name, missing(row[field.name], field) ? null : row[field.name]]));
}

function blankState(applies) {
  if (applies === true) { return CELL.skipped; }
  return applies === false ? CELL.notShown : CELL.unknown;
}

function cellState(row, field, rule, seen) {
  if (!missing(row[field.name], field)) { return CELL.answered; }
  if (!rule.condition) { return CELL.unknown; }
  return blankState(evaluateCondition(rule.condition, seen));
}

// Per column, the state of every cell, from the `applies_when` rules of the codebook. Original values are not read
// back or changed. Rules that cannot be parsed are listed in `errors`, and their cells are `unknown`.
export function routingStates(rows, fields) {
  const rules = new Map(fields.map(field => [field.name, parseRule(field)]));
  const seen = rows.map(row => answers(row, fields));
  const states = new Map(fields.map(field => [field.name,
    rows.map((row, index) => cellState(row, field, rules.get(field.name), seen[index]))]));
  const errors = [...rules].filter(([, rule]) => rule.error).map(([name, rule]) => ({ name, message: rule.error }));
  return { states, errors };
}
