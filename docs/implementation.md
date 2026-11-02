# Current implementation

[Setup and use](../README.md) · [Scope](spec.md) · [Plan](plan.md) ·
[Data/assets](data-and-assets.md) · [Maintenance](maintenance.md).

## State and event ownership

`Dataset` owns imported rows, inferred fields, independent annotation columns,
visible/highlighted row IDs, view configurations and session results. Original cell
values survive type overrides and fits. Cluster name columns are read-only getters
backed by fitted memberships and editable dictionaries; numeric IDs stay internal.

`model.views` is the authoritative card order. Layout keeps derived DOM references,
width/height preferences and explicit row breaks. Grip moves, squeeze commits and
menu ordering all update that same model order. Cards hold chart configuration and
result IDs, while `Results` owns arrays, memberships, parameters and provenance.
Removing cards does not discard results. There is no project reload/persistence yet.

| Event | Meaning |
| --- | --- |
| `data` | Dataset replaced; reset cards, indexes and prepared-feature cache |
| `config` | Analysis settings changed without reinferring schema |
| `schema` | Column/type structure changed; rebuild affected controls/table header |
| `views` | Card configuration/order changed |
| `view` | Visible row ordering/membership or displayed values refreshed |
| `selection` | Transient highlight/representative changed |
| `annotation` | Existing annotation values changed |
| `results` | Saved results or group dictionaries changed |

Analysis-only configuration changes retain field objects and do not refresh the
table. Type/category-limit changes reinfer schema. Result name/cut edits update
virtual-column statistics, emit one result change and refresh displayed rows;
color edits avoid row refresh. Creating a clustering emits schema once for its new
name column. Copying cluster labels initializes a complete independent annotation
in one operation, with one schema/view update rather than one refresh per group.

## Analysis and workers

`Analysis` owns prepared-feature caching and worker orchestration; `Projection` and
`Clustering` own explicit jobs and completion/cancellation guards. Python handles
feature preparation, PCA/SVD, lexical indexing and clustering. UMAP, parsing, static
vectors and sentence inference use separate workers. The worker client serializes
analysis work, renews its inactivity timeout on progress and rejects stale responses.
Python/scikit-learn initialize at startup, with idle/loading/loaded/failed states
from explicit worker messages. Warmup survives import cancellation, and analyses
wait for it. Sentence assets remain opt-in.

Feature cache keys contain dataset/schema revisions, selected annotation revisions
and feature settings, not serialized records. Cache hits do not rebuild row payloads.
Selection, filtering and UMAP display settings do not invalidate prepared features.
Completed prepared arrays survive cancellation; replacing the dataset releases the
old main-thread cache. Saved representations may share cached arrays but retain
independent names. Numeric downloads retain zero-based original row positions.

Table features and TF-IDF feed a common dense prepared space. Wide inputs reduce
with SVD to at most 32 dimensions before mapping/clustering. Static Dutch/English
spaCy vectors use normalized mean or TF-IDF-weighted word pooling. Fields combine
by weighted mean or concatenation with square-root weights, then record normalization.
Empty/unknown text has no vector but remains in the table and exports.

Sentence inference is opt-in Transformers.js WASM with a choice of pinned multilingual
MiniLM-L12 or Dutch-only MiniLM-L6. Token windows retain original wording and special-token/padding
semantics; attention-masked means produce normalized 384-dimensional vectors.
Defaults are 126 content tokens per chunk, no overlap. Overlap aggregation weights
newly covered tokens; explicit first-window truncation reports omitted coverage.
Worker-local per-field vectors use a bounded LRU cache and are reused for weighting
and compatible field aggregation changes. Model assets and export recipes are pinned for offline use.

Sentence embeddings offer an independent "Include field descriptions" option.
Descriptions come from field metadata, falling back to label/title and then column
name. Each chunk gets the description prefix; empty fields still produce no vector.
Prefixes use at most 32 tokens and one third of the chunk budget, reserving room for
the response. Overlap that leaves no room is rejected. Token coverage and chunk
weights count response tokens only; coverage also records description tokens per
chunk. Normalized field vectors combine using means, grouped means or concatenation.
The option is absent for static word vectors. Prefix changes invalidate affected
per-field caches, while weights reuse vectors. Input field descriptions participate
in the prepared-feature cache key and are saved in `inputFields` with exported
representations/maps, so later metadata edits do not change a fitted result.
Legacy `description-mean` recipes still run, and reopen as a mean plus the context
checkbox. Grouped means normalize weighted field means per group and give available
groups equal weight. Group names come from the `group` of the field's metadata (`x-linked-codebook.group` in a codebook), with map-specific
overrides and an explicit Other fields fallback. A 0–100% identity fraction mixes
normalized shared and concatenated group vectors with square-root scales. Endpoint
vectors omit unused components; all-empty rows stay excluded. Identity preserves
zero missing-group blocks and therefore does not eliminate missingness effects.
Grouping/weights/identity reuse per-field inference caches. Saved aggregation recipes
include the effective groups, identity fraction and weighting/missing policies.
RMC follow-up descriptions explicitly include the parent question in both JSON
and spreadsheet codebooks; application behavior does not special-case that dataset.

MiniBatch K-means is the fast default. Agglomerative linkage is capped at 5,000
usable records. HDBSCAN retains noise and a condensed density hierarchy. Saved
agglomerative trees support cluster-count cuts; density trees support stable/fine
selection and separation changes without refitting distances/features. The private
scikit-learn 1.7 tree API is isolated in `workers/density.py` and covered by native
and worker checks. Stable branch dictionaries preserve edited names and colors.

Phrase naming and subset descriptions share compatible sparse field matrices in a
bounded worker registry, retaining the inspector’s active index. Coverage/contrast evidence feeds a bounded
joint search with disjoint normalized words across active groups and sibling-name
blocks for trees. At most 100 active groups receive bundles up to the selected maximum phrase count
(four by default, with an implicit minimum of one); each phrase follows global n-gram settings. Insufficient
evidence keeps unique ID labels. Manual edits are locked until cleared. Naming runs
only when Suggest phrase names is checked at fit time, or through the legend’s
Rename all action, never on highlighting or index rebuilding.
The residual density group displays Other (internal ID -1). Individual phrase evidence is retained in exported clustering results.

## Linked views and layout

Scatter rendering serves data axes and saved maps. Bokeh models, zoom and selection
links survive layout changes. Histograms, bars and heatmaps aggregate original row
IDs; partial-bin selections stay precise. Legends are DOM renderers with editable
name/color dictionaries, visible counts and hierarchical folding/color families.
Annotations remain independent of cluster edits and later fits.

`view-layout-math.js` owns packing and height snapping; `view-layout.js` arranges DOM
nodes, while pointer/divider/card-drag modules own gesture lifecycle. Widths fit
rows at a 280px minimum. Active squeeze previews temporarily allow narrower empty
slots, retaining the divider under the pointer until commit or cancellation.
Header dragging previews valid insertion positions and rejects overfull rows.
Rows fit panel height with a 180px minimum and 16px snap range. Legends can grow
rows; only the visualization panel scrolls. Divider resets are local and retain
card order, row breaks and unrelated proportions.

Query parsing uses a typed Boolean AST. Edits and Enter highlight visible matches;
invalid queries preserve the last valid highlight. ⏷ explicitly pins highlighted
rows within the current visible population, then clears the query AST/editor and
highlight. Only pinned record IDs remain; the status-bar count shows the result.
× clears the selection/query without changing pinned IDs; ↺ clears filters and
the preview. Brushing/tapping replaces highlights, Shift adds and
Alt/Option intersects. Table preview narrows only the table. Highlight/filter/layout
changes never implicitly refit results.

## Contextual help and progressive controls

The local help reader bundles `docs/help/*.md` through Vite's eager raw imports.
Its small Markdown compiler escapes raw HTML, permits only internal help links and
folds Settings/Troubleshooting/Technical details into native details. Each page starts
with purpose, an example, steps and interpretation; the overview links the learning
path. Native `title` tooltips take their one-sentence text from the target page/section,
avoiding a second copy in the UI. Context buttons use a small circular native button
with a larger hit area; clicks open the same help dialog at the relevant anchor.
Back/Forward retain navigation/scroll history, and closing restores focus to the
original form without discarding its draft. No help content or data is fetched remotely.

Map field weights, long-text settings, aggregation detail and UMAP tuning start
collapsed. Live summaries show equal/custom weights and group counts. Shared lexical
fields are shown explicitly with a link to the phrase modal; applying it updates the
underlying draft. Clustering prefers an existing named input representation, while
current map settings and explicitly labeled 2D coordinates remain selectable.

## Subset descriptions

The inspector's predicate choice supports phrases, metadata facets or both. Facets
work without a text index, including tables with no text fields. They share scopes,
minimum record support, cloud/table presentation and click-to-query highlighting.
Phrase and facet result rows carry a label, ordinary filter AST, full matching row
IDs and subset/comparison evidence (support, precision and recall). Explicit filtering
remains separate. Phrase matching still uses the configured lexical analyzer.

Metadata candidates use a separate revision-keyed sparse presence cache. Generate
up to 50 most-supported case-insensitive category values, both boolean values,
missing/not-missing predicates, and up to four non-overlapping numeric/date quantile
ranges. Cuts are fixed from all usable dataset values, retain ties, and never change
on brushing/filtering. Constant predicates, identifiers and analysis-derived columns
are omitted. Original values and metadata missing codes are respected; quoted
literal `null` and literal `*` in equality queries are distinct from missingness and
prefix search. Annotation/schema/result changes invalidate the cache; worker resets
resend its columns. No analysis is fitted by facet discovery.

Facet contrast is a difference in record coverage shares, not c-TF-IDF. Subset-share
ranking uses record frequency; lift uses the same smoothed coverage formula as
phrases. Balanced/semantic splits reuse the existing sparse population scorer and
saved embeddings. Facet populations include missing values; semantic ranking further
restricts the scored population to records present in the chosen embedding result.
Split support is required on both sides. Phrase and facet clouds stay separate when
both are shown, preserving their different score units. Precision is measured within
the requested subset plus comparison, recall within the subset. These are descriptive
in-sample figures, not held-out rule evaluation. Rule induction remains future work.

All-record phrase counts are shared by lexical maps and descriptions. Each field has its own
vocabulary/sparse count matrix, keyed by dataset revision, field, n-gram sizes and
stopwords. Four index variants share compatible matrices; the active inspector index
is protected from eviction. Naming can build a compatible index automatically; the
inspector adopts it if its controls match. Different settings remain independent.
Worker cancellation clears descriptors and matrices. Subset changes reuse the index.
The toolbar Phrase counting settings modal owns text fields, phrase lengths and
stoplists. Named presets retain settings across cache eviction and worker resets,
clearing with the dataset. Counts build lazily for descriptions/maps/naming. The
inspector’s inline controls contain comparison/ranking options only.

Tokenization is cached independently of count settings. TF-IDF transforms the shared
per-field count matrices after column concatenation, preserving field boundaries.
Word-vector pooling receives tokens from the same analyzer, including when the
phrase range excludes unigrams. Sentence embeddings retain their own tokenizer.
The sentence worker sorts chunks by length across 128-record tiles, groups them
into 16-token length buckets and infers batches of up to eight, preserving record
mapping and overlap weights. Clouds remain the default description display.

Phrases do not cross records, fields, punctuation or removed-word boundaries.
Stopwords may occur internally in phrases but are omitted at phrase boundaries;
built-in lists retain negation. Vocabulary caps at 20,000 terms per field, selected
by global occurrences. Minimum support counts records, not repetitions.

For class term counts `t[c,w]`, `L[c] = sum_w t[c,w]` and `A = mean_c L[c]`:

`cTFIDF[c,w] = (t[c,w] / L[c]) * log(1 + A / sum_c t[c,w])`

Contrast subtracts comparison weights. Smoothed document lift is
`log2(((subset_df + .5)/(subset_n + 1)) / ((rest_df + .5)/(rest_n + 1)))`.
Empty classes have zero weights; coverage denominators include empty records.
These are descriptive, field-local rankings, not comparable across fields/subsets.

Display pruning checks 150 candidates and retains up to 15 phrases. A nested shorter
phrase is suppressed when matching record sets have at least 90% Jaccard overlap
and its score is no more than 10% below the longer phrase. Disabling redundancy
reduction restores unpruned rankings without changing the index or scores.
Clouds use deterministic local Canvas packing and accessible SVG text; unplaced
phrases remain available below. Click/keyboard activation highlights exact indexed
membership immediately. Representatives use positive-contrast weighted counts.

Scopes include highlighted versus remaining visible rows, filtered versus remaining
table rows, and clustering groups/branches with explicit rest/sibling comparisons.
With no highlight, Automatic ranking describes current filtered records using
record-frequency prevalence. Entire dataset and current filtered records are also
explicit scopes. Common phrases count presence once per record; balanced splits
use binary entropy, maximized at 50/50. Both use records with usable field text as
their denominator. Minimum support applies to both branches for split rankings.
Semantic splits require an explicitly selected saved embedding representation and
rank the fraction of embedding variation explained by each phrase partition:
`p * (1-p) * ||mean_yes - mean_no||² / mean_squared_distance_to_population_mean`.
Only records with usable field text and saved embeddings participate. Original
embeddings are reused, never 2D map coordinates; no model is fitted implicitly.
Sparse presence products run in bounded vocabulary blocks in the Python worker.

Separate field clouds are the default. Combined clouds retain independent
field/phrase entries, even for identical phrase text, with a compact colored field
legend, field-qualified accessible names and a Field column in table mode.
Presentation applies equally to whole populations, highlights, query selections
and cluster/branch comparisons. Phrase clicks retain their exact field predicates.
Cloud sizes follow the chosen score within each displayed cloud; comparative
c-TF-IDF scores remain field-local descriptive heuristics, not calibrated effects.
Changing the highlighted set resumes highlight descriptions from cluster scope;
representative-only navigation preserves that scope. Arbitrary saved subsets and
annotation-label comparisons remain planned.

## Packaging and validation

The app build uses an explicit public-asset allowlist and approved examples only.
Dev mode opts into private fixtures. The historical feasibility harness has a
separate build/output, and the shared zlib compatibility shim lives in `src/`.
Only required ONNX Runtime WASM pairs are prepared; Vite uses ORT's external-WASM
package condition to avoid emitting another binary. GPU/JSPI backend assets are
excluded. Assets remain locally bundlable and runtime requests stay same-origin.

Ruff/ESLint enforce complexity 8, function statements 35 and module statements 250.
Current aggregate ceilings are Python 2500 and JavaScript 10200; rationale is linked
from [AGENTS.md](../AGENTS.md). Browser journeys cover workspace/export, card layout,
map/index/clustering and explicit embeddings. Unit/native/WASM checks cover numeric
and boundary behavior. Optional check reports are written under ignored `.cache/checks/`;
current commands are in the README. Chromium is tested; other-browser behavior and
large multi-field model workloads still need evaluation.

## Description queries and adjacent legends

Phrase buttons in clouds and tables emit ordinary query AST terms with the exact
ngram operator `~`, serialized as `field~"phrase"`. Substring `:` search retains its
existing semantics. The worker reuses count-index memberships or the canonical
lexical tokenizer, preserving punctuation boundaries, normalization and Unicode
case folding. Query matching covers all visible records, including comparison-set
matches, while existing filters remain in force. Matching does not depend on the
current vocabulary cap, stoplist or n-gram length settings. Async results are cached,
stale requests cannot replace a newer query, and filtering remains explicit.
Predicate activation combines the current editor AST with AND, respecting OR
parentheses and skipping already-required conjuncts. A predicate inside an OR is
not already required. Invalid editor input stays intact until corrected or cleared.
Changed external selections clear the query preview and invalidate pending matches;
record navigation within the same membership keeps it. Query-owned selection events
retain their AST. Clear-selection/filter/import also invalidate queued asynchronous
highlights so an old phrase job cannot restore a cleared selection or commit a filter.
`query-predicates.js` is the serializer/construction boundary for phrases, metadata
facets and future rules; learned-rule UI is not implemented yet.

A map follows an immediately neighboring legend in authoritative card order. The
right-hand legend wins when both neighbors are legends. The map's C selector shows
the clustering column and is disabled while linked; it becomes editable when the
pair separates. Legend result changes, group renaming, color edits and tree cuts
therefore retain matching map colors. No coordinates or memberships are refitted.


## Variable picker

`<variable-picker>` is a native custom element with ordinary DOM and no framework
or Shadow DOM. Pure search/grouping/coverage helpers live in variable-options.js;
popup rendering and keyboard behavior live in variable-picker-dom.js. It has no
Dataset dependency. Callers supply eligible descriptors and own the saved selection.

Set `multiple` first, then `variables` (id, label, description, type, group, optional
nonMissing/missing counts), then `selected` (an array of IDs). `disabled`, `aria-label`
and optional `caption` control presentation. Programmatic updates emit no events;
user changes emit a bubbling `change` with `detail.selected`. IDs remain exact,
including the empty-string sentinel for None and # Row. Search is accent-insensitive
and intersects words with type/selected-only filters; filtering never drops selection.

Popovers use the browser top layer to escape card clipping while remaining inside
modal forms. Native buttons/checkboxes provide selection semantics. Arrows move
through results; Enter/Space activate, Escape restores the trigger, and Tab follows
normal focus order. Reconnection reuses controls without adding document listeners.
Chart columns, map inputs, phrase fields and visible table columns share this picker.
Embedding weights remain in the map form, separate from the reusable control.
Table column choices are presentation state; filters, exports and analysis inputs
remain independent. They reset on import and newly added columns become visible.
