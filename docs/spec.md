# Scope and stages

Browser-only exploration and enrichment of fewer than 20,000 mixed-type records.
Import CSV, JSON records, XLSX and SAV; export original values plus annotation columns
as CSV, JSON records or XLSX. No SAV export or project archive initially.

Use Bokeh Canvas for linked distributions, pairwise visual exploration and 2D maps.
Brushing highlights records; filtering is explicit. A shared typed Boolean AST drives
query filtering; incomplete input preserves the last valid AST. Fit on all records
initially, and never refit as a side effect of highlighting or filtering.

Users choose one or multiple text fields and optional chunking. Cluster records.
Counts/TF-IDF with words/ngrams, SVD, NMF and LDA run in Pyodide/scikit-learn;
DBSCAN/HDBSCAN accept suitable reduced features or embeddings. LDA uses counts,
NMF uses nonnegative inputs. UMAP runs in a JS worker; PCA/SVD are fast alternatives.
Stopword lists are per language and configurable; do not strip stopwords from the
transformer input by default. Chunk vectors must be aggregated back to record IDs.

Transformer inference uses WASM and requires explicit opt-in before model loading.
The 118 MB multilingual model also needs its tokenizer; display the total download.
Prefer a smaller, verified Dutch/static embedding option once suitable weights exist.
Static assets may download, but all assets must also be locally bundlable.
No records, text, queries, annotations or derived vectors leave the user's machine.

Each annotation set is an independent categorical column, initially one label per
record, with bulk assign and clear. Analyses use stable group IDs and an editable
ID-to-name dictionary for topic/cluster renaming. New fits do not overwrite prior
annotation columns. Materialize chosen labels into table columns for export.

1. Feasibility: import fidelity, local assets, Canvas linking, WASM ML and UMAP scale.
2. Data workflow: import/type review, table, annotation columns/dictionaries and export.
3. Exploration: query editor, linked views, highlighting and explicit filtering.
4. Text workflow: field selection, chunking, preprocessing, algorithms and bulk labels.

Each stage ends with a working demo, measured limitations and user feedback.
