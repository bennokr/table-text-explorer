// Survey answers: how much free text counts, whether each codebook group counts equally, and whether an answer
// nearly everyone gives counts for little. The values are the ones the evaluation (docs/evaluation-survey.md) used.
export function defaultSurvey() { return { textWeight: 0.35, balance: true, common: true }; }

export function defaultConfig() {
  return { categoryLimit: 50, numericCategoryLimit: 8, overrides: {}, mode: 'table', language: 'nl',
    features: null, stopwords: '', neighbors: 15, epochs: 150,
    sentenceChunking: 'chunks', sentenceChunkSize: 126, sentenceOverlap: 0,
    vectorLanguage: 'nl', pooling: 'mean', combine: 'mean', weights: {},
    includeDescriptions: false, groupIdentity: 0.2, survey: defaultSurvey() };
}

// Text columns default to TF-IDF maps: they need no model download and beat static word vectors in
// every comparison (docs/evaluation.md). Without a usable text column the table input remains.
export function defaultInputMode(fields) {
  const text = field => field.kind === 'text' && !field.identifier && !field.annotation && !field.derived;
  return fields.some(text) ? 'text' : 'table';
}
