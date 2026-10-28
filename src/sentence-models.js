export const sentenceModels = {
  multilingual: { id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2', revision: '2c4055b',
    label: 'Multilingual MiniLM-L12 · ~135 MB', dimensions: 384, maxTokens: 128 },
  dutch: { id: 'MarkSelles/dutch-minilm-l6-v2', revision: 'a4838aae5e41cfe6bd1ce54bafd1a4cdf3489bd7',
    label: 'Dutch MiniLM-L6 · Dutch only · ~59 MB', dimensions: 384, maxTokens: 128 },
};

export function sentenceModelFor(key = 'multilingual') {
  const model = Object.hasOwn(sentenceModels, key) ? sentenceModels[key] : null;
  if (!model) { throw new Error('Choose a supported local sentence model.'); }
  return model;
}
