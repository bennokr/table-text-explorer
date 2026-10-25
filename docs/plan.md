# Plan

Each stage ends with a working local demo and user feedback.

1. **Subset descriptions (current stage):** distinctive words, bigrams and trigrams;
   c-TF-IDF and contrast, record support, and excerpts. Analyze text fields separately.
   Reuse an explicitly built all-record vocabulary for brushes and query subsets.
2. **Clustering:** HDBSCAN on prepared features; explicit fits, noise/unassigned records,
   editable names, reusable subset descriptions, and independent annotation columns.
3. **Sentence embeddings:** opt-in Transformers.js WASM, Dutch-capable multilingual
   model, optional chunking, cached per-field vectors and configurable aggregation.
   Compare representations through the same linked views and descriptions.
4. **Other text models:** NMF/LDA and additional lexical representations as needed.

Low-priority stretch: descriptive metadata facets (categorical values, booleans,
missingness, numeric ranges), then shallow decision-tree filter induction. Translate
rules into the existing filter AST; show support, precision/recall and held-out
performance. Exclude membership-derived predictors. Preview suggestions before applying.

Shared foundation: a subset plus an explicit comparison set, reusable for brushes,
queries, cluster IDs and annotation labels. No filter or selection change refits a
projection. All data and computation remain local; exports stay table-only.
