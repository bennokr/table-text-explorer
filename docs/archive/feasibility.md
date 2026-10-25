> Historical stage notes. See [current implementation](../implementation.md) and [plan](../plan.md).

# Stage 1: feasibility findings

The local static harness uses the provided fixtures. No fixture is uploaded. Raw
diagnostics and timings are in [feasibility-results.json](../evidence/feasibility-results.json).
The browser suite disables WebGPU/WebGL, blocks every non-local request, checks that
no model is requested before opt-in, and exercises the built bundle rather than Vite
development modules. Tests use an installed Chromium; other browsers remain untested.

## Imports and table export

- CSV: 987 records, 13 columns, no parse errors.
- SAV: 439 records, 134 numeric columns, 21 variable labels and 9 value-label sets.
- XLSX: 20 records, 195 columns, including multiple Dutch text fields.
- CSV/JSON/XLSX annotated-table round trips preserve row IDs and annotation values.
  This probe uses the CSV fixture; complete typed round-trip fidelity is a stage 2 task.
- `@irbisadm/statfmt` parses SAV in the browser after adapting its eager Node zlib
  imports to fflate. Native pyreadstat/ReadStat provides an independent local reference.
  The additional synthetic SAV includes Unicode, a 300-character string, a system
  missing value, a user missing code, variable labels and value labels.

ReadStat WASM exists: [Haybarn packages a DuckDB-WASM extension](https://www.npmjs.com/package/@haybarn/ext-read_stat-h1-5-3),
and [a standalone browser build is documented](https://johnmcm.com/licenses).
Neither WASM reader was integrated or benchmarked here. The similarly named
[readstat-rs browser wrapper only implements SAS](https://curtisalexander.github.io/readstat-rs/introduction.html).
Recommendation: use the tested TypeScript ReadStat port for this scope unless later
fixtures reveal fidelity gaps. Avoid adding another database runtime solely for SAV.

## Analysis and rendering

Pyodide 0.29.0 supplies scikit-learn 1.7.0. On the 20 text-bearing XLSX records, counts,
word unigrams/bigrams, explicit Dutch stopwords, TF-IDF, SVD, NMF, LDA, DBSCAN,
HDBSCAN and PCA execute successfully. NMF receives TF-IDF and LDA receives counts;
clustering receives reduced features. This proves runtime compatibility, not topic quality.

A synthetic 20,000-record sparse lexical pipeline has 1,553 features and 140,000
nonzero entries. TF-IDF/SVD takes 0.97 seconds in the final run. The complete
Pyodide worker probe including initialization/package loading takes 22.4 seconds locally.
NMF/LDA and density clustering have only been checked on the small real text fixture;
their 20k-record performance and worst-case memory use remain unmeasured.

UMAP-JS in a worker takes 1.48 seconds for 1,000 synthetic records and 33.32
seconds for 20,000 records with 16 dimensions, 15 neighbors and 100 epochs. These are
single-machine measurements, not guarantees for 384-dimensional embeddings or long
documents. Use feature reduction, progress reporting and explicit cancellation in the
product. A worker can always be terminated without blocking the UI.

Bokeh Canvas renders two linked 20k-point views and a selected-count histogram.
Separate plot toolbars preserve the intended active brush; merged toolbars can select
a different default drag tool. The suite performs a pointer brush, verifies unchanged
visibility and updated aggregate counts, then clicks an explicit filter control and
checks original source rows remain intact. Reverse aggregate-to-record brushing and
the query AST editor belong to stage 3.

## Embeddings and smaller defaults

The opt-in model is `Xenova/paraphrase-multilingual-MiniLM-L12-v2`, with pinned model
revision and Q8 weights. Its download is 118,308,126 bytes of weights plus a 17,082,913
byte tokenizer and small configuration files: about 135 MB total in decimal units.
Use the total in the UI. The probe uses Transformers.js 4.3.1, WASM, one inference
thread and local model assets, with remote model access disabled.

The smoke test compares two related Dutch medical sentences with an unrelated Dutch
football sentence. It checks finite 384-dimensional vectors and relative similarity;
it does not establish quality on a representative Dutch evaluation set or 20k texts.
The final run passes: related Dutch sentence cosine 0.975 versus 0.063 for the
unrelated sentence. Loading and embedding four sentences takes 22.1 seconds.
There are no model requests before opt-in and no external requests during the suite.

[Floret's format and inference design](https://github.com/explosion/floret) support
compact full-coverage subword vectors, but its upstream project does not provide a
verified Dutch checkpoint in the material inspected. A browser adapter must reproduce
the MurmurHash-based word/subword mapping and pass reference parity tests. No Dutch
floret model has been downloaded, ported or quality-tested in this stage.

A smaller Dutch static-vector candidate is spaCy's
[nl_core_news_md](https://github.com/explosion/spacy-models/blob/master/meta/nl_core_news_md-3.8.0.json):
20,000 unique 300-dimensional rows imply 24 MB as float32, before lookup metadata.
This is a candidate for a build-time extraction, not a measured browser payload or a
floret model. Static pooled vectors also need separate quality checks and handle
cross-language alignment differently from the multilingual sentence transformer.
For now, the verified baseline is model-free TF-IDF/SVD; do not silently substitute
an English-only small transformer and claim Dutch support.

## Quality and packaging

Ruff and ESLint cap cyclomatic complexity at 8 and function statements at 35.
ESLint also caps nesting at 3 and function length at 65 nonblank/noncomment lines.
AST budget checks cap modules at 250 statements and each language at 2,500 statements.
These are readability constraints, not targets to minimize. Tests, scripts and configs
count; dependencies, generated bundles and downloaded assets do not.

The bundle includes local runtime/model assets. No external origin is required at
runtime after preparation. It is a localhost-served static folder, not a file:// app.
The preparation script currently copies all ONNX Runtime variants conservatively;
bundle pruning remains product work. The optional weights and test fixtures are not
source-controlled. The test bundle contains local fixture copies and must not be published.

The full browser suite, Ruff, ESLint, formatting, AST budgets and production build pass. The dependency audit was reduced to
zero known advisories by using the maintained SheetJS tarball, current Transformers.js,
fflate 0.8.3 and a patched xmldom override. CI automation is not yet configured.

Stage 2 should deliver the actual table workflow and persistent annotation columns,
including stable cluster/topic IDs with an editable naming dictionary. No analysis
run may overwrite a manually created annotation column.

Final browser run: 2026-10-23. Both SAV cases match native ReadStat for column order,
all values, variable labels, value labels and user missing ranges. A pointer brush
highlights 4,770 records without hiding any; explicit filtering reduces visibility to
4,770 while retaining all 20,000 original source records. All 33 intercepted requests
are local GET requests; there are zero browser page errors.

## v0.2 scope and code budget

The JavaScript total statement ceiling increases from 2500 to 3500 for the requested
word-vector pipeline, worker-based imports, task progress, independent linked projections,
and regression checks. The per-module 250-statement ceiling and complexity/readability
limits remain unchanged. Feature preparation is extracted from projection controls rather
than compressed to fit the old total. Python retains its 2500-statement total ceiling.

Static spaCy 3.7 medium vectors are converted at build-preparation time, without shipping
spaCy or its tagging/parsing pipelines to the browser. Pinned Dutch and English assets
contain 20,000 × 300 float32 vectors (24 MB), plus word-to-row JSON: 32.93 MB Dutch and
32.13 MB English total. They are separate, unaligned monolingual spaces, not multilingual
sentence models. Each generated directory retains the model/source licenses and a
manifest with revision, source hashes and output hashes. Unknown words are skipped;
coverage is reported, with zero-vector records left unprojected. The tokenizer is a
Unicode word tokenizer, not spaCy's full language tokenizer. Stopwords are optional.
