import { franc } from 'franc-min';
import { inferLanguage } from 'linked-codebook';
import { TAGS } from './language-tags.js';

// The detector that linked-codebook asks (its protocol decides when: prose cells only, a sample, and an agreement
// threshold). franc answers 'und' for texts it cannot place, which linked-codebook counts against the column.
export function detect(text) {
  const code = franc(text);
  return code === 'und' ? null : TAGS[code] ?? code;
}

/** The language of every text column that has one, by field name. A language in the column's metadata wins. */
export function fieldLanguages(fields, rows, metadata = {}) {
  const found = fields.filter(field => field.kind === 'text' && !field.derived).map(field =>
    [field.name, metadata[field.name]?.language ?? inferLanguage(rows.map(row => row[field.name]), detect)?.language]);
  return Object.fromEntries(found.filter(([, language]) => language));
}

const supported = ['nl', 'en'];

/**
 * Defaults for the settings that depend on language, from the languages of the text columns in table order: the
 * stoplist is the supported languages found (none if there are none) and the vector model is that of the first column
 * in a supported language. Nothing is set when no column has a language, so the defaults stay.
 */
export function languageSettings(languages) {
  const tags = Object.values(languages);
  if (!tags.length) { return {}; }
  const known = supported.filter(tag => tags.includes(tag));
  const vector = tags.find(tag => supported.includes(tag));
  return { language: known.length ? known.join(',') : 'none', ...vector ? { vectorLanguage: vector } : {} };
}

/** What to tell the person: the languages found, and the ones that have no stoplist or vector model here. */
export function languageNote(languages) {
  const tags = [...new Set(Object.values(languages))];
  const missing = tags.filter(tag => !supported.includes(tag));
  if (!tags.length) { return ''; }
  const found = `text language: ${tags.join(', ')}`;
  return missing.length ? `${found} (no stoplist or vector model for ${missing.join(', ')})` : found;
}
