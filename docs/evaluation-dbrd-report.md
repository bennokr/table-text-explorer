# dbrd evaluation

2224 records. Gold manifest revision 1. 4 fine groups (257-855 each).

## Which columns does the text vary with?

**Text field `text`** (skill beyond length)

| column | class | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|---:|
| sentiment | strong | 0.444 | 0.266 | 0.267 | 0.344 | 0.279 |
| rating | strong | 0.254 | 0.135 | 0.137 | 0.195 | 0.156 |
| review_id | null | -0.021 | -0.023 | -0.019 | -0.019 | -0.021 |
| word_count | length | n/a | n/a | n/a | n/a | n/a |
| character_count | length | n/a | n/a | n/a | n/a | n/a |
| null floor: mean (max) | null | -0.019 (max -0.009) | -0.020 (max -0.002) | -0.019 (max -0.005) | -0.018 (max -0.007) | -0.019 (max -0.010) |
| strong columns beat every null |  | True | True | True | True | True |

Without the 32-d reduction, `text`

| strong column: 32-d / raw (tuned) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| sentiment | 0.446 / 0.428 | 0.269 / 0.345 | 0.270 / 0.348 | 0.347 / 0.408 | 0.281 / 0.347 |
| rating | 0.257 / 0.167 | 0.135 / 0.175 | 0.140 / 0.170 | 0.196 / 0.192 | 0.158 / 0.151 |
| raw dimensions | 384 | 300 | 300 | 384 | 384 |
| null max | -0.000 / -0.008 | 0.004 / -0.001 | 0.002 / 0.000 | 0.001 / -0.006 | -0.000 / -0.007 |

## Do phrase descriptions explain a group?

**Text field `text`** (held-out, top 10 phrases)

| ranking | AUC fine | AUC coarse | AUC null | AUC length | precision fine | coverage fine |
|---|---:|---:|---:|---:|---:|---:|
| frequency | 0.519 | 0.530 | 0.500 | 0.903 | 0.26 | 0.99 |
| balanced | 0.501 | 0.521 | 0.499 | 0.888 | 0.26 | 0.95 |
| ctfidf | 0.499 | 0.497 | 0.496 | 0.911 | 0.26 | 0.99 |
| contrast | 0.580 | 0.624 | 0.499 | 0.917 | 0.32 | 0.91 |
| lift | 0.520 | 0.552 | 0.500 | 0.576 | 0.44 | 0.07 |

Examples, `text`

| group | held-out AUC | top contrast phrases |
|---|---:|---:|
| coarse:negative | 0.63 | niet, boek, geen, helaas, veel, wel, jammer |
| coarse:positive | 0.62 | haar, ze, leven, hoe, hun, mooi, liefde |
| fine:1 | 0.51 | niet, boek, geen, heb, mij, slecht, me |
| fine:2 | 0.62 | niet, helaas, wel, veel, geen, vond, had |
| fine:4 | 0.61 | ze, haar, leven, hun, liefde, eigen, elkaar |
| fine:5 | 0.57 | mooi, hoe, prachtig, heel, the, leven, lezen |
| length:longest-quartile | 0.92 | ze, haar, zich, lezer, hun, auteur, of |

## Do unsupervised splits surface the known structure?

`text`

| level | ranking | information | percentile | top phrases |
|---|---:|---:|---:|---:|
| coarse | frequency | 0.003 | 34 | boek, niet, verhaal, wat, over, wel |
| coarse | balanced | 0.004 | 48 | over, wel, nog, ze, meer, al |
| coarse | text axis 1 (tfidf) | 0.006 | 61 | boek, heb, vond, mij, niet, lezen |
| coarse | best of 3 axes (tfidf) | 0.006 | 61 | boek, heb, vond, mij, niet, lezen |
| coarse | random directions, mean, not a null (tfidf) | 0.004 | 55 |  |
| coarse | random record splits, true null (tfidf) | 0.004 | 49 |  |
| coarse | semantic (words-mean) | 0.005 | 49 | ze, zich, haar, hun, leven, worden |
| coarse | text axis 1 (words-mean) | 0.005 | 54 | boek, heb, niet, me, wel, vond |
| coarse | best of 3 axes (words-mean) | 0.006 | 61 | niet, wel, of, wat, worden, veel |
| coarse | random directions, mean, not a null (words-mean) | 0.004 | 55 |  |
| coarse | random record splits, true null (words-mean) | 0.004 | 49 |  |
| coarse | semantic (words-tfidf) | 0.005 | 54 | zich, ze, haar, hun, leven, worden |
| coarse | text axis 1 (words-tfidf) | 0.005 | 55 | haar, zich, hun, lezer, leven, worden |
| coarse | best of 3 axes (words-tfidf) | 0.005 | 61 | haar, the, vader, ze, moeder, jaar |
| coarse | random directions, mean, not a null (words-tfidf) | 0.004 | 49 |  |
| coarse | random record splits, true null (words-tfidf) | 0.004 | 49 |  |
| coarse | semantic (sentences-multilingual) | 0.006 | 60 | haar, ze, zich, leven, hun, verhaal |
| coarse | text axis 1 (sentences-multilingual) | 0.006 | 63 | boek, heb, lezen, vond, me, mij |
| coarse | best of 3 axes (sentences-multilingual) | 0.006 | 63 | boek, heb, lezen, vond, me, mij |
| coarse | random directions, mean, not a null (sentences-multilingual) | 0.004 | 51 |  |
| coarse | random record splits, true null (sentences-multilingual) | 0.004 | 49 |  |
| coarse | semantic (sentences-dutch) | 0.006 | 62 | haar, ze, verhaal, leven, zich, moeder |
| coarse | text axis 1 (sentences-dutch) | 0.006 | 63 | haar, ze, zich, leven, hun, moeder |
| coarse | best of 3 axes (sentences-dutch) | 0.006 | 63 | haar, ze, zich, leven, hun, moeder |
| coarse | random directions, mean, not a null (sentences-dutch) | 0.004 | 50 |  |
| coarse | random record splits, true null (sentences-dutch) | 0.004 | 49 |  |
| coarse | best possible 15 phrases | 0.021 | 100 |  |
| coarse | typical phrase | 0.001 | 50 |  |
| fine | frequency | 0.004 | 36 | boek, niet, verhaal, wat, over, wel |
| fine | balanced | 0.004 | 44 | over, wel, nog, ze, meer, al |
| fine | text axis 1 (tfidf) | 0.005 | 61 | boek, heb, vond, mij, niet, lezen |
| fine | best of 3 axes (tfidf) | 0.005 | 61 | boek, heb, vond, mij, niet, lezen |
| fine | random directions, mean, not a null (tfidf) | 0.004 | 52 |  |
| fine | random record splits, true null (tfidf) | 0.004 | 51 |  |
| fine | semantic (words-mean) | 0.005 | 62 | ze, zich, haar, hun, leven, worden |
| fine | text axis 1 (words-mean) | 0.005 | 55 | boek, heb, niet, me, wel, vond |
| fine | best of 3 axes (words-mean) | 0.005 | 61 | niet, wel, of, wat, worden, veel |
| fine | random directions, mean, not a null (words-mean) | 0.004 | 55 |  |
| fine | random record splits, true null (words-mean) | 0.004 | 51 |  |
| fine | semantic (words-tfidf) | 0.005 | 60 | zich, ze, haar, hun, leven, worden |
| fine | text axis 1 (words-tfidf) | 0.004 | 55 | haar, zich, hun, lezer, leven, worden |
| fine | best of 3 axes (words-tfidf) | 0.004 | 55 | haar, zich, hun, lezer, leven, worden |
| fine | random directions, mean, not a null (words-tfidf) | 0.004 | 51 |  |
| fine | random record splits, true null (words-tfidf) | 0.004 | 51 |  |
| fine | semantic (sentences-multilingual) | 0.006 | 65 | haar, ze, zich, leven, hun, verhaal |
| fine | text axis 1 (sentences-multilingual) | 0.005 | 59 | boek, heb, lezen, vond, me, mij |
| fine | best of 3 axes (sentences-multilingual) | 0.005 | 59 | boek, heb, lezen, vond, me, mij |
| fine | random directions, mean, not a null (sentences-multilingual) | 0.004 | 53 |  |
| fine | random record splits, true null (sentences-multilingual) | 0.004 | 51 |  |
| fine | semantic (sentences-dutch) | 0.006 | 65 | haar, ze, verhaal, leven, zich, moeder |
| fine | text axis 1 (sentences-dutch) | 0.005 | 62 | haar, ze, zich, leven, hun, moeder |
| fine | best of 3 axes (sentences-dutch) | 0.005 | 62 | haar, ze, zich, leven, hun, moeder |
| fine | random directions, mean, not a null (sentences-dutch) | 0.004 | 55 |  |
| fine | random record splits, true null (sentences-dutch) | 0.004 | 51 |  |
| fine | best possible 15 phrases | 0.012 | 100 |  |
| fine | typical phrase | 0.001 | 50 |  |

## Clusters and maps

### Clusters, `text`

| run (ARI / NMI) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| minibatch (coarse, k=2) vs sentiment | 0.03 / 0.02 | 0.02 / 0.01 | 0.02 / 0.01 | 0.01 / 0.01 | 0.00 / 0.00 |
| minibatch (fine, k=4) vs rating | 0.03 / 0.02 | 0.01 / 0.02 | 0.02 / 0.03 | 0.01 / 0.02 | 0.01 / 0.02 |
| agglomerative (coarse, k=2) vs sentiment | 0.01 / 0.01 | 0.02 / 0.02 | 0.02 / 0.01 | 0.00 / 0.00 | 0.01 / 0.01 |
| agglomerative (fine, k=4) vs rating | 0.02 / 0.03 | 0.01 / 0.02 | 0.02 / 0.02 | 0.01 / 0.01 | 0.00 / 0.01 |
| hdbscan (density) vs rating | 0.00 / 0.00, 100% unassigned | 0.00 / 0.00, 100% unassigned | 0.00 / 0.00, 100% unassigned | 0.00 / 0.00, 100% unassigned | -0.00 / 0.01, 93% unassigned |
| minibatch (coarse), 20 subsample+seed runs vs sentiment: mean ± sd | 0.03 ± 0.01 / 0.02 ± 0.00 | 0.02 ± 0.01 / 0.02 ± 0.00 | 0.02 ± 0.00 / 0.01 ± 0.00 | 0.01 ± 0.00 / 0.01 ± 0.00 | 0.01 ± 0.01 / 0.01 ± 0.00 |
| minibatch (fine), 20 subsample+seed runs vs rating: mean ± sd | 0.04 ± 0.01 / 0.04 ± 0.02 | 0.02 ± 0.00 / 0.02 ± 0.00 | 0.02 ± 0.00 / 0.02 ± 0.00 | 0.03 ± 0.02 / 0.04 ± 0.02 | 0.01 ± 0.01 / 0.02 ± 0.01 |

Paired differences, `text`

| minus TF-IDF: mean [95% CI], wins | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|
| coarse ARI | -0.01 [-0.01, -0.00], wins 1/20 | -0.01 [-0.01, -0.01], wins 1/20 | -0.01 [-0.01, -0.01], wins 0/20 | -0.01 [-0.02, -0.01], wins 0/20 |
| coarse NMI | -0.00 [-0.01, -0.00], wins 3/20 | -0.01 [-0.01, -0.00], wins 2/20 | -0.01 [-0.01, -0.01], wins 0/20 | -0.01 [-0.01, -0.01], wins 0/20 |
| fine ARI | -0.02 [-0.03, -0.01], wins 0/20 | -0.02 [-0.03, -0.01], wins 1/20 | -0.01 [-0.02, -0.00], wins 6/20 | -0.02 [-0.03, -0.02], wins 1/20 |
| fine NMI | -0.02 [-0.03, -0.01], wins 1/20 | -0.02 [-0.03, -0.01], wins 2/20 | -0.01 [-0.02, +0.01], wins 7/20 | -0.02 [-0.03, -0.01], wins 1/20 |

### Maps, `text`

| representation (kNN purity) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch | chance |
|---|---:|---:|---:|---:|---:|---:|
| 32-d text vectors, coarse | 0.66 | 0.60 | 0.60 | 0.64 | 0.61 | 0.50 |
| 32-d text vectors, fine | 0.40 | 0.36 | 0.37 | 0.38 | 0.36 | 0.30 |
| PCA (2-d), coarse | 0.54 | 0.52 | 0.52 | 0.54 | 0.53 | 0.50 |
| PCA (2-d), fine | 0.32 | 0.31 | 0.30 | 0.32 | 0.31 | 0.29 |
| SVD (2-d), coarse | 0.53 | 0.51 | 0.51 | 0.52 | 0.52 | 0.50 |
| SVD (2-d), fine | 0.31 | 0.30 | 0.30 | 0.31 | 0.31 | 0.29 |
| UMAP (2-d), coarse | 0.61 | 0.56 | 0.55 | 0.59 | 0.55 | 0.50 |
| UMAP (2-d), fine | 0.36 | 0.33 | 0.33 | 0.35 | 0.32 | 0.29 |

|  | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| UMAP kNN purity, coarse: mean ± sd over 5 seeds | 0.604 ± 0.015 | 0.558 ± 0.003 | 0.548 ± 0.003 | 0.587 ± 0.012 | 0.553 ± 0.009 |
| UMAP kNN purity, fine: mean ± sd over 5 seeds | 0.359 ± 0.010 | 0.329 ± 0.003 | 0.325 ± 0.004 | 0.348 ± 0.006 | 0.326 ± 0.005 |
