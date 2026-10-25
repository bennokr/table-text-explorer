# Implementation

Setup, example preparation and commands: [README](../README.md).
Product contract: [spec](spec.md). Next stages: [plan](plan.md).
Historical notes: [archive](archive/). Aggregate test reports: [evidence](evidence/).

## Current app

Four compact panels: linked Bokeh Canvas scatter views, virtualized table, chart stack
with an n-gram inspector tab, and full record viewer. Imports: CSV, JSON records, SAV,
first XLSX sheet. Exports: original table plus annotations as CSV/JSON/XLSX.

Brushing highlights shared record IDs; explicit filtering snapshots that selection.
The table's optional selection preview only narrows the table. Query expressions use
a typed Boolean AST; unfinished/invalid input retains the last valid filter.
Original cell values and annotation columns survive fits and type overrides.

PCA/SVD and text features use Pyodide/sklearn; UMAP uses its own worker. Table parsing
also runs in a worker. Two scatters retain independent fit configurations and coordinates.
Wide inputs are reduced with SVD to at most 32 dimensions before PCA or UMAP.
Reduced-space hover shows fitted text columns; data-axis hover shows field values.

Dutch/English static word vectors are extracted from pinned spaCy medium models into
local assets (~33/~32 MB including word lookup). Fields use normalized mean or TF-IDF
word pooling, then weighted averaging or vector concatenation. Unknown/empty text
contributes no vector; unembedded records remain in the table. Transformer inference
and clustering currently exist only in the historical feasibility harness.

## Subset inspector

An explicit all-record n-gram index is independent of projection fitting. It is shared
with the Python analysis worker and invalidated on data/text-index setting changes or
worker cancellation. Selection and filter changes recompute descriptions only.
Each text field has its own vocabulary and sparse count matrix; classes are the subset
and its comparison set. No n-gram spans records, columns, punctuation or removed words.
Internal stopwords are allowed in phrases; stopwords at phrase boundaries are omitted.
Built-in stoplists retain negations; explicit additional stopwords are honored.

Vocabulary is capped at 20,000 terms per field, selected by global occurrence count.
Support counts records, not repetitions. Default ranking is c-TF-IDF contrast;
raw c-TF-IDF and smoothed document lift are also available. With class term counts
`t[c,w]`, `L[c] = sum_w t[c,w]`, and `A = mean_c L[c]`:

`cTFIDF[c,w] = (t[c,w] / L[c]) * log(1 + A / sum_c t[c,w])`

Empty classes have zero weights. Contrast subtracts the comparison class weight.
Document lift is `log2(((subset_df + .5)/(subset_n + 1)) /
((rest_df + .5)/(rest_n + 1)))`. Coverage denominators include empty-text records.
These are descriptive rankings. Representatives use normalized document term counts
weighted by positive contrast; term excerpts and explicit highlight actions use exact
indexed term membership, not substring search. Scores are local to each field and
current comparison; they should not be compared across different fields or subsets.

The formula follows [class-based TF-IDF](https://maartengr.github.io/BERTopic/getting_started/ctfidf/ctfidf.html)
without requiring BERTopic or a language model. Unlike concatenating class documents,
we aggregate per-record counts to preserve n-gram boundaries.

## Quality and limits

Ruff/ESLint enforce complexity 8, function statements 35, and module statements 250.
Python's total statement ceiling is 2500; JavaScript's is 3500, including checks and
the historical harness. This stage remains within those budgets. Ranking and indexing
live in small Python functions, separate from controls and rendering. The earlier
budget increase is recorded in [historical feasibility notes](archive/feasibility.md).

Validation: 16 JavaScript tests and six native numerical/boundary tests pass, including
a synthetic 20,000-record sparse index. Browser checks cover actual Pyodide indexing
on Bol (1,000 records, two fields) and DBRD (2,224 records), exact phrase highlighting,
filter comparisons, rapid selection changes, and retained PCA/SVD coordinates.
Production and Vite development checks disable GPU APIs and block external traffic.
Aggregate results: [terms-results.json](evidence/terms-results.json).

Runtime requests stay same-origin. Static assets must be prepared/bundled first.
Browser checks disable GPU APIs and block external traffic; Chromium is tested.
Annotations/caches are in memory; export annotations before closing. Model quality,
large multi-field lexical indexes, and other browsers need further evaluation.
