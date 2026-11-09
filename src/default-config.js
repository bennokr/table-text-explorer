export function defaultConfig() {
  return { categoryLimit: 50, numericCategoryLimit: 8, overrides: {}, mode: 'table', language: 'nl',
    features: null, stopwords: '', neighbors: 15, epochs: 150,
    sentenceModel: 'multilingual', sentenceChunking: 'chunks', sentenceChunkSize: 126, sentenceOverlap: 0,
    vectorLanguage: 'nl', pooling: 'mean', combine: 'mean', weights: {},
    includeDescriptions: false, fieldGroups: {}, groupIdentity: 0.2 };
}
