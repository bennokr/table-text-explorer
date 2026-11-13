import { groupFiles, lexiconFrom } from './lexicon-parse.js';

// The word lists and folding rules of each language, bundled from src/lexicon/<code>/*.txt. Adding a language
// means adding a folder with the same four files:
//   stop      never alone and never at the edge of a phrase
//   lead      may start a phrase or sit inside one, never alone or last
//   negation  kept as phrases of their own; cluster names avoid them at the edges
//   fold      suffix rules that give inflected forms one key (see the header of src/lexicon/nl/fold.txt)
// Outside the bundler (the unit tests) `import.meta.glob` does not exist and there are no files; tests load them
// with groupFiles. The call has to stay a plain call for the bundler to find it.
function bundledFiles() {
  try { return import.meta.glob('./lexicon/*/*.txt', { query: '?raw', import: 'default', eager: true }); }
  catch { return {}; }
}

const files = bundledFiles();

export const languages = groupFiles(files);

export const lexiconFor = config => lexiconFrom(languages, config);
