# rechtspraak evaluation

2360 records. Gold manifest revision 2. 12 fine groups (160-200 each).

## Which columns does the text vary with?

**Text field `summary`** (skill beyond length)

| column | class | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|---:|
| legal_area | strong | 0.734 | 0.594 | 0.591 | 0.476 | 0.517 |
| legal_subarea | strong | 0.664 | 0.531 | 0.538 | 0.526 | 0.572 |
| court_type | moderate | 0.497 | 0.352 | 0.346 | 0.336 | 0.366 |
| procedure | moderate | 0.294 | 0.172 | 0.166 | 0.161 | 0.204 |
| court | weak | 0.259 | 0.177 | 0.176 | 0.164 | 0.185 |
| ruling_words | structure | 0.140 | 0.102 | 0.104 | 0.095 | 0.100 |
| ecli_sequence | uncertain | 0.044 | 0.014 | 0.012 | 0.011 | 0.021 |
| year | weak | -0.020 | -0.025 | -0.025 | -0.027 | -0.026 |
| summary_words | length | n/a | n/a | n/a | n/a | n/a |
| null floor: mean (max) | null | -0.046 (max -0.014) | -0.039 (max -0.013) | -0.039 (max -0.013) | -0.036 (max -0.010) | -0.037 (max -0.009) |
| strong columns beat every null |  | True | True | True | True | True |

**Text field `ruling_excerpt`** (skill beyond length)

| column | class | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|---:|
| legal_area | strong | 0.990 | 0.950 | 0.921 | 0.883 | 0.906 |
| court_type | echoed | 0.973 | 0.789 | 0.681 | 0.732 | 0.768 |
| legal_subarea | strong | 0.898 | 0.834 | 0.816 | 0.808 | 0.826 |
| court | echoed | 0.820 | 0.485 | 0.392 | 0.506 | 0.629 |
| procedure | moderate | 0.636 | 0.459 | 0.391 | 0.434 | 0.437 |
| year | echoed | 0.362 | 0.008 | -0.010 | 0.180 | 0.102 |
| ruling_words | structure | 0.224 | 0.186 | 0.184 | 0.179 | 0.181 |
| ecli_sequence | uncertain | 0.123 | 0.055 | 0.039 | 0.066 | 0.078 |
| summary_words | structure | 0.075 | 0.027 | 0.026 | 0.034 | 0.030 |
| null floor: mean (max) | null | -0.041 (max -0.014) | -0.038 (max -0.013) | -0.038 (max -0.011) | -0.036 (max -0.012) | -0.036 (max -0.013) |
| strong columns beat every null |  | True | True | True | True | True |

Without the 32-d reduction, `summary`

| strong column: 32-d / raw (tuned) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| legal_subarea | 0.659 / 0.713 | 0.538 / 0.622 | 0.551 / 0.615 | 0.537 / 0.618 | 0.585 / 0.674 |
| legal_area | 0.625 / 0.727 | 0.595 / 0.688 | 0.587 / 0.678 | 0.452 / 0.575 | 0.491 / 0.644 |
| raw dimensions | 384 | 300 | 300 | 384 | 384 |
| null max | -0.000 / -0.003 | 0.000 / -0.006 | 0.000 / -0.006 | 0.001 / -0.008 | 0.001 / -0.009 |

Without the 32-d reduction, `ruling_excerpt`

| strong column: 32-d / raw (tuned) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| legal_subarea | 0.897 / 0.887 | 0.833 / 0.882 | 0.814 / 0.867 | 0.804 / 0.856 | 0.825 / 0.864 |
| legal_area | 0.990 / 0.990 | 0.951 / 0.982 | 0.920 / 0.956 | 0.877 / 0.941 | 0.896 / 0.937 |
| raw dimensions | 384 | 300 | 300 | 384 | 384 |
| null max | 0.001 / -0.004 | -0.000 / -0.007 | -0.001 / -0.008 | -0.000 / -0.010 | -0.000 / -0.010 |

## Do phrase descriptions explain a group?

**Text field `summary`** (held-out, top 10 phrases)

| ranking | AUC fine | AUC coarse | AUC null | AUC length | precision fine | coverage fine |
|---|---:|---:|---:|---:|---:|---:|
| frequency | 0.709 | 0.627 | 0.501 | 0.528 | 0.42 | 0.78 |
| balanced | 0.712 | 0.629 | 0.500 | 0.508 | 0.42 | 0.78 |
| ctfidf | 0.729 | 0.635 | 0.499 | 0.534 | 0.50 | 0.76 |
| contrast | 0.789 | 0.739 | 0.504 | 0.630 | 0.67 | 0.68 |
| lift | 0.734 | 0.713 | 0.501 | 0.522 | 0.90 | 0.47 |

**Text field `ruling_excerpt`** (held-out, top 10 phrases)

| ranking | AUC fine | AUC coarse | AUC null | AUC length | precision fine | coverage fine |
|---|---:|---:|---:|---:|---:|---:|
| frequency | 0.890 | 0.875 | 0.501 | 0.688 | 0.15 | 1.00 |
| balanced | 0.808 | 0.860 | 0.495 | 0.619 | 0.25 | 0.99 |
| ctfidf | 0.927 | 0.914 | 0.503 | 0.713 | 0.28 | 1.00 |
| contrast | 0.962 | 0.971 | 0.498 | 0.730 | 0.43 | 1.00 |
| lift | 0.852 | 0.931 | 0.501 | 0.533 | 0.96 | 0.71 |

Examples, `summary`

| group | held-out AUC | top contrast phrases |
|---|---:|---:|
| coarse:Bestuursrecht | 0.82 | besluit, beroep, omgevingsvergunning, appellant, college, verweerder, aanvraag |
| coarse:Civiel recht | 0.64 | bw, werknemer, werkgever, verzoek, arbeidsovereenkomst, inbreuk, kort geding |
| coarse:Strafrecht | 0.75 | verdachte, hof, maatregel, beslissing, gevangenisstraf, terbeschikkingstelling, jaar |
| fine:Arbeidsrecht | 0.87 | werknemer, werkgever, arbeidsovereenkomst, ontslag, staande voet, voet, ontslag op staande |
| fine:Belastingrecht | 0.73 | belanghebbende, woz, inspecteur, eiseres, wet, ib, waarde |
| fine:Insolventierecht | 0.85 | schuldsaneringsregeling, fw, verzoek, wsnp, schulden, dwangakkoord, toelating |
| fine:Intellectueel-eigendomsrecht | 0.83 | inbreuk, auteursrecht, intellectuele, eigendom, intellectuele eigendom, kort geding, kort |
| fine:Materieel strafrecht | 0.77 | verdachte, gevangenisstraf, maanden, rechtbank, voorwaardelijk, veroordeling, veroordeeld |
| fine:Omgevingsrecht | 0.89 | omgevingsvergunning, college, perceel, besluit, verleend, locatie, omgevingsvergunning verleend |
| fine:Penitentiair strafrecht | 0.81 | hof, maatregel, terbeschikkingstelling, terbeschikkinggestelde, verlenging, overheidswege, beslissing |
| fine:Personen- en familierecht | 0.70 | moeder, gezag, minderjarige, 1, bw, vader, machtiging |
| fine:Socialezekerheidsrecht | 0.85 | appellant, appellante, uitkering, uwv, geen, terecht, bijstand |
| fine:Strafprocesrecht | 0.76 | verdachte, beslissing, wrakingsverzoek, slachtoffer, hof, rechter, rechters |
| fine:Verbintenissenrecht | 0.65 | gedaagde, vordering, overeenkomst, ontruiming, eiseres, bw, ontbinding |
| fine:Vreemdelingenrecht | 0.75 | vreemdeling, staatssecretaris, eiser, asiel, besluit, verblijfsvergunning, verweerder |
| length:longest-quartile | 0.63 | verdachte, gevangenisstraf, inbreuk, slachtoffer, maanden, poging, medeplegen |

Examples, `ruling_excerpt`

| group | held-out AUC | top contrast phrases |
|---|---:|---:|
| coarse:Bestuursrecht | 0.99 | uitspraak, besluit, verweerder, eiser, college, beroep, belanghebbende |
| coarse:Civiel recht | 0.94 | 2, gedaagde, producties, 1, procedure, hierna, c |
| coarse:Strafrecht | 0.98 | verdachte, of, officier van justitie, justitie, beslissing, terechtzitting, slachtoffer |
| fine:Arbeidsrecht | 0.98 | werknemer, arbeidsovereenkomst, 2, verweerster, kantonrechter, verzoekster, 1 |
| fine:Belastingrecht | 0.97 | belanghebbende, inspecteur, uitspraak, heffingsambtenaar, bezwaar, aanslag, waarde |
| fine:Insolventierecht | 0.96 | verzoeker, schuldsaneringsregeling, verzoekster, schuldeisers, bewindvoerder, fw, verzoek |
| fine:Intellectueel-eigendomsrecht | 0.97 | producties, c, gedaagde, s, v, akte, b |
| fine:Materieel strafrecht | 0.96 | verdachte, of, slachtoffer, officier van justitie, justitie, feit, terechtzitting |
| fine:Omgevingsrecht | 0.99 | college, besluit, omgevingsvergunning, perceel, verweerder, uitspraak, appellant |
| fine:Penitentiair strafrecht | 0.97 | terbeschikkinggestelde, beslissing, hof, verdachte, maatregel, veroordeelde, of |
| fine:Personen- en familierecht | 0.96 | minderjarige, moeder, beschikking, vader, noemen, man, vrouw |
| fine:Socialezekerheidsrecht | 0.98 | besluit, appellante, uwv, appellant, uitspraak, raad, uitkering |
| fine:Strafprocesrecht | 0.92 | betrokkene, verdachte, of, beslissing, rechter, officier van justitie, justitie |
| fine:Verbintenissenrecht | 0.91 | gedaagde, 2, 1, partij, procedure, vonnis, geïntimeerde |
| fine:Vreemdelingenrecht | 0.98 | eiser, vreemdeling, staatssecretaris, verweerder, uitspraak, besluit, aanvraag |
| length:longest-quartile | 0.73 | of, verdachte, producties, 1, vonnis, 2, gedaagde |

## Do unsupervised splits surface the known structure?

`summary`

| level | ranking | information | percentile | top phrases |
|---|---:|---:|---:|---:|
| coarse | frequency | 0.018 | 32 | niet, geen, beroep, artikel, worden, rechtbank |
| coarse | balanced | 0.018 | 32 | niet, geen, beroep, artikel, worden, rechtbank |
| coarse | semantic (words-mean) | 0.011 | 50 | niet, lid, hr, bw, ro, artikel |
| coarse | semantic (words-tfidf) | 0.012 | 66 | hr, ro, niet, lid, 81, omgevingsvergunning |
| coarse | semantic (sentences-multilingual) | 0.043 | 80 | verdachte, omgevingsvergunning, gevangenisstraf, staatssecretaris, niet, college |
| coarse | semantic (sentences-dutch) | 0.042 | 83 | verdachte, gevangenisstraf, omgevingsvergunning, college, staatssecretaris, asiel |
| coarse | best possible 15 phrases | 0.047 | 100 |  |
| coarse | typical phrase | 0.002 | 50 |  |
| fine | frequency | 0.015 | 38 | niet, geen, beroep, artikel, worden, rechtbank |
| fine | balanced | 0.015 | 38 | niet, geen, beroep, artikel, worden, rechtbank |
| fine | semantic (words-mean) | 0.012 | 56 | niet, lid, hr, bw, ro, artikel |
| fine | semantic (words-tfidf) | 0.013 | 72 | hr, ro, niet, lid, 81, omgevingsvergunning |
| fine | semantic (sentences-multilingual) | 0.033 | 82 | verdachte, omgevingsvergunning, gevangenisstraf, staatssecretaris, niet, college |
| fine | semantic (sentences-dutch) | 0.034 | 84 | verdachte, gevangenisstraf, omgevingsvergunning, college, staatssecretaris, asiel |
| fine | best possible 15 phrases | 0.034 | 100 |  |
| fine | typical phrase | 0.002 | 50 |  |

`ruling_excerpt`

| level | ranking | information | percentile | top phrases |
|---|---:|---:|---:|---:|
| coarse | frequency | 0.022 | 38 | rechtbank, 1, 2, tegen, mr, 3 |
| coarse | balanced | 0.036 | 38 | a, artikel, worden, zaaknummer, m, onder |
| coarse | semantic (words-mean) | 0.154 | 94 | verdachte, parketnummer, ten laste, of omstreeks, ten laste gelegd, za |
| coarse | semantic (words-tfidf) | 0.188 | 94 | verdachte, parketnummer, za, tenlastelegging, terechtzitting, ten laste |
| coarse | semantic (sentences-multilingual) | 0.195 | 96 | verdachte, parketnummer, terechtzitting, tenlastelegging, tegenspraak, gewezen naar aanleiding |
| coarse | semantic (sentences-dutch) | 0.200 | 96 | verdachte, parketnummer, geboorteplaats, terechtzitting, geboren, tenlastelegging |
| coarse | best possible 15 phrases | 0.240 | 100 |  |
| coarse | typical phrase | 0.005 | 50 |  |
| fine | frequency | 0.027 | 39 | rechtbank, 1, 2, tegen, mr, 3 |
| fine | balanced | 0.032 | 38 | a, artikel, worden, zaaknummer, m, onder |
| fine | semantic (words-mean) | 0.082 | 90 | verdachte, parketnummer, ten laste, of omstreeks, ten laste gelegd, za |
| fine | semantic (words-tfidf) | 0.105 | 95 | verdachte, parketnummer, za, tenlastelegging, terechtzitting, ten laste |
| fine | semantic (sentences-multilingual) | 0.098 | 94 | verdachte, parketnummer, terechtzitting, tenlastelegging, tegenspraak, gewezen naar aanleiding |
| fine | semantic (sentences-dutch) | 0.105 | 95 | verdachte, parketnummer, geboorteplaats, terechtzitting, geboren, tenlastelegging |
| fine | best possible 15 phrases | 0.128 | 100 |  |
| fine | typical phrase | 0.004 | 50 |  |

## Clusters and maps

### Clusters, `summary`

| run (ARI / NMI) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| minibatch (coarse, k=3) vs legal_area | 0.18 / 0.22 | 0.02 / 0.03 | 0.08 / 0.08 | 0.13 / 0.14 | 0.12 / 0.12 |
| minibatch (fine, k=12) vs legal_subarea | 0.27 / 0.42 | 0.06 / 0.16 | 0.08 / 0.18 | 0.20 / 0.34 | 0.25 / 0.36 |
| agglomerative (coarse, k=3) vs legal_area | 0.11 / 0.23 | -0.01 / 0.03 | -0.00 / 0.02 | 0.13 / 0.17 | 0.16 / 0.13 |
| agglomerative (fine, k=12) vs legal_subarea | 0.17 / 0.38 | 0.08 / 0.20 | 0.07 / 0.19 | 0.18 / 0.36 | 0.19 / 0.38 |
| hdbscan (density) vs legal_subarea | 0.05 / 0.39, 54% unassigned | 0.01 / 0.05, 71% unassigned | 0.01 / 0.06, 88% unassigned | 0.02 / 0.22, 80% unassigned | 0.01 / 0.03, 24% unassigned |
| minibatch (coarse), 20 subsample+seed runs vs legal_area: mean ± sd | 0.16 ± 0.10 / 0.19 ± 0.11 | 0.03 ± 0.03 / 0.05 ± 0.04 | 0.04 ± 0.03 / 0.06 ± 0.03 | 0.09 ± 0.04 / 0.11 ± 0.03 | 0.10 ± 0.05 / 0.11 ± 0.04 |
| minibatch (fine), 20 subsample+seed runs vs legal_subarea: mean ± sd | 0.23 ± 0.04 / 0.39 ± 0.03 | 0.07 ± 0.01 / 0.17 ± 0.01 | 0.09 ± 0.01 / 0.20 ± 0.02 | 0.22 ± 0.02 / 0.35 ± 0.01 | 0.25 ± 0.02 / 0.37 ± 0.02 |

Paired differences, `summary`

| minus TF-IDF: mean [95% CI], wins | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|
| coarse ARI | -0.13 [-0.18, -0.08], wins 1/20 | -0.12 [-0.17, -0.07], wins 0/20 | -0.07 [-0.12, -0.03], wins 5/20 | -0.07 [-0.12, -0.01], wins 6/20 |
| coarse NMI | -0.14 [-0.20, -0.09], wins 1/20 | -0.13 [-0.18, -0.08], wins 1/20 | -0.08 [-0.13, -0.03], wins 5/20 | -0.08 [-0.14, -0.03], wins 6/20 |
| fine ARI | -0.16 [-0.18, -0.14], wins 0/20 | -0.14 [-0.16, -0.12], wins 0/20 | -0.01 [-0.03, +0.01], wins 9/20 | +0.02 [-0.00, +0.04], wins 12/20 |
| fine NMI | -0.22 [-0.23, -0.20], wins 0/20 | -0.19 [-0.21, -0.17], wins 0/20 | -0.04 [-0.06, -0.03], wins 1/20 | -0.02 [-0.03, +0.00], wins 8/20 |

### Maps, `summary`

| representation (kNN purity) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch | chance |
|---|---:|---:|---:|---:|---:|---:|
| 32-d text vectors, coarse | 0.82 | 0.70 | 0.71 | 0.73 | 0.76 | 0.35 |
| 32-d text vectors, fine | 0.58 | 0.44 | 0.47 | 0.54 | 0.58 | 0.09 |
| PCA (2-d), coarse | 0.51 | 0.43 | 0.43 | 0.52 | 0.49 | 0.36 |
| PCA (2-d), fine | 0.21 | 0.15 | 0.14 | 0.20 | 0.20 | 0.08 |
| SVD (2-d), coarse | 0.50 | 0.40 | 0.42 | 0.49 | 0.49 | 0.35 |
| SVD (2-d), fine | 0.19 | 0.12 | 0.12 | 0.18 | 0.19 | 0.09 |
| UMAP (2-d), coarse | 0.80 | 0.63 | 0.64 | 0.70 | 0.74 | 0.35 |
| UMAP (2-d), fine | 0.56 | 0.36 | 0.39 | 0.50 | 0.56 | 0.08 |

|  | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| UMAP kNN purity, coarse: mean ± sd over 5 seeds | 0.800 ± 0.005 | 0.636 ± 0.006 | 0.648 ± 0.003 | 0.701 ± 0.004 | 0.732 ± 0.004 |
| UMAP kNN purity, fine: mean ± sd over 5 seeds | 0.553 ± 0.002 | 0.364 ± 0.009 | 0.394 ± 0.010 | 0.500 ± 0.002 | 0.554 ± 0.005 |

### Clusters, `ruling_excerpt`

| run (ARI / NMI) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| minibatch (coarse, k=3) vs legal_area | 0.80 / 0.76 | 0.12 / 0.14 | 0.20 / 0.21 | 0.29 / 0.33 | 0.26 / 0.33 |
| minibatch (fine, k=12) vs legal_subarea | 0.48 / 0.68 | 0.18 / 0.33 | 0.29 / 0.43 | 0.45 / 0.60 | 0.46 / 0.61 |
| agglomerative (coarse, k=3) vs legal_area | 0.58 / 0.69 | 0.12 / 0.15 | 0.19 / 0.28 | 0.25 / 0.39 | 0.17 / 0.19 |
| agglomerative (fine, k=12) vs legal_subarea | 0.49 / 0.69 | 0.31 / 0.49 | 0.35 / 0.54 | 0.45 / 0.65 | 0.39 / 0.59 |
| hdbscan (density) vs legal_subarea | 0.30 / 0.63, 15% unassigned | 0.01 / 0.26, 81% unassigned | 0.04 / 0.12, 61% unassigned | 0.05 / 0.13, 48% unassigned | 0.05 / 0.39, 61% unassigned |
| minibatch (coarse), 20 subsample+seed runs vs legal_area: mean ± sd | 0.68 ± 0.21 / 0.72 ± 0.15 | 0.12 ± 0.03 / 0.14 ± 0.02 | 0.16 ± 0.03 / 0.19 ± 0.03 | 0.32 ± 0.09 / 0.35 ± 0.07 | 0.26 ± 0.06 / 0.30 ± 0.06 |
| minibatch (fine), 20 subsample+seed runs vs legal_subarea: mean ± sd | 0.52 ± 0.05 / 0.71 ± 0.03 | 0.23 ± 0.02 / 0.38 ± 0.02 | 0.27 ± 0.02 / 0.43 ± 0.02 | 0.43 ± 0.03 / 0.59 ± 0.02 | 0.44 ± 0.04 / 0.59 ± 0.02 |

Paired differences, `ruling_excerpt`

| minus TF-IDF: mean [95% CI], wins | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|
| coarse ARI | -0.56 [-0.66, -0.46], wins 0/20 | -0.52 [-0.62, -0.43], wins 0/20 | -0.36 [-0.47, -0.25], wins 1/20 | -0.43 [-0.53, -0.32], wins 1/20 |
| coarse NMI | -0.57 [-0.65, -0.50], wins 0/20 | -0.53 [-0.60, -0.46], wins 0/20 | -0.37 [-0.45, -0.29], wins 0/20 | -0.42 [-0.50, -0.34], wins 0/20 |
| fine ARI | -0.30 [-0.32, -0.27], wins 0/20 | -0.25 [-0.27, -0.22], wins 0/20 | -0.09 [-0.12, -0.06], wins 0/20 | -0.08 [-0.11, -0.06], wins 1/20 |
| fine NMI | -0.33 [-0.34, -0.31], wins 0/20 | -0.27 [-0.29, -0.26], wins 0/20 | -0.12 [-0.14, -0.10], wins 0/20 | -0.11 [-0.13, -0.10], wins 0/20 |

### Maps, `ruling_excerpt`

| representation (kNN purity) | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch | chance |
|---|---:|---:|---:|---:|---:|---:|
| 32-d text vectors, coarse | 0.99 | 0.94 | 0.92 | 0.95 | 0.95 | 0.35 |
| 32-d text vectors, fine | 0.86 | 0.73 | 0.73 | 0.79 | 0.79 | 0.09 |
| PCA (2-d), coarse | 0.98 | 0.57 | 0.59 | 0.76 | 0.66 | 0.35 |
| PCA (2-d), fine | 0.45 | 0.23 | 0.25 | 0.35 | 0.34 | 0.08 |
| SVD (2-d), coarse | 0.94 | 0.46 | 0.47 | 0.57 | 0.56 | 0.35 |
| SVD (2-d), fine | 0.39 | 0.15 | 0.17 | 0.22 | 0.23 | 0.08 |
| UMAP (2-d), coarse | 0.99 | 0.95 | 0.93 | 0.95 | 0.95 | 0.35 |
| UMAP (2-d), fine | 0.85 | 0.70 | 0.70 | 0.79 | 0.78 | 0.08 |

|  | tfidf | words-mean | words-tfidf | sentences-multilingual | sentences-dutch |
|---|---:|---:|---:|---:|---:|
| UMAP kNN purity, coarse: mean ± sd over 5 seeds | 0.994 ± 0.001 | 0.946 ± 0.002 | 0.921 ± 0.003 | 0.952 ± 0.003 | 0.949 ± 0.005 |
| UMAP kNN purity, fine: mean ± sd over 5 seeds | 0.850 ± 0.003 | 0.699 ± 0.007 | 0.698 ± 0.003 | 0.788 ± 0.002 | 0.776 ± 0.004 |
