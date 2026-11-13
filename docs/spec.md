# Scope and stages

Browser-only exploration and enrichment of fewer than 20,000 mixed-type records.
Import CSV, JSON records, XLSX and SAV; export original values plus annotation columns
as CSV, JSON records or XLSX. No SAV export or project archive initially.

Use Bokeh Canvas for linked distributions, pairwise visual exploration and 2D maps.
Brushing highlights records; filtering is explicit. A shared typed Boolean AST drives
query highlighting; incomplete input preserves the last valid highlight. Filtering
requires an explicit action. Fit on all records
initially, and never refit as a side effect of highlighting or filtering.

Users choose one or multiple text columns and optional chunking. Cluster records.
Counts/TF-IDF with words/ngrams, SVD and clustering run in Pyodide/scikit-learn.
HDBSCAN accepts suitable reduced features or embeddings. UMAP runs in a JS worker;
PCA/SVD are fast alternatives. NMF/LDA/DBSCAN exist only in the historical
feasibility harness, not the application or current delivery plan.
Word lists are per language and configurable (stopwords, lead words and negations, plus
folding rules for inflected forms: `src/lexicon/`); do not strip stopwords from the
transformer input by default. Chunk vectors must be aggregated back to record IDs.

Transformer inference uses WASM and requires explicit opt-in before model loading.
The multilingual model also needs its tokenizer; expose the total download size.
Verified Dutch/English static embeddings are available as a smaller option.
Static assets may download, but all assets must also be locally bundlable.
No records, text, queries, annotations or derived vectors leave the user's machine.

Each annotation set is an independent categorical column, initially one label per
record, with bulk assign and clear. Analyses use stable group IDs and an editable
ID-to-name dictionary for topic/cluster renaming. New fits do not overwrite prior
annotation columns. Materialize chosen labels into table columns for export.

Implementation status: [implementation](implementation.md).
Next working stages: [plan](plan.md). Each stage ends with a working demo and feedback.
