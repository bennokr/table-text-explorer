// The map form offers UMAP and one "linear projection". The linear method is chosen from the input
// mode instead of asking. PCA centres the data first; uncentred SVD keeps the mean direction as its
// first axis. In 30 comparisons (TF-IDF, word and sentence representations, three text fields),
// PCA gave better neighbourhood purity in 27, tied in 2 and was 0.006 behind in 1
// (docs/evaluation.md), so every mode uses PCA. The table keeps the switch so a mode can change.
// Survey answers are already a metric embedding (classical MDS) of their distance, so PCA only rotates it.
const LINEAR_METHOD = { table: 'pca', survey: 'pca', text: 'pca', words: 'pca', sentences: 'pca' };

export function linearMethod(mode) { return LINEAR_METHOD[mode] ?? 'pca'; }

// Form choice ('umap' or 'linear') to the method name stored with a map.
export function mapMethod(choice, mode) { return choice === 'linear' ? linearMethod(mode) : choice; }

// Stored method name ('umap', 'pca', 'svd') to the form choice.
export function methodChoice(method) { return method === 'umap' ? 'umap' : 'linear'; }
