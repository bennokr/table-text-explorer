# Rechtspraak evaluation

1190 rulings, 12 sub-areas (90-100 each), 10 years, 6 court types {'Rechtbank': 695, 'Gerechtshof': 283, 'Raad van State': 81, 'Centrale Raad van Beroep': 66, 'Overig': 41, 'Hoge Raad': 24}, 23 courts. Median words: {'summary_words': 27, 'ruling_words': 1924}.

## Which columns does the text vary with?

**Text field `summary`**

| column | expected | z naive | z length-controlled |
|---|---:|---:|---:|
| legal_area | strong | 185.4 | 75.6 |
| legal_subarea | strong | 357.1 | 55.7 |
| ruling_words | length | 48.4 | 32.0 |
| court_type | moderate | 146.9 | 29.8 |
| procedure | moderate | 12.5 | 11.1 |
| court | weak | 54.9 | 7.8 |
| ecli_sequence | uncertain | 13.7 | 6.7 |
| shuffled:court_type:0 | null control | 0.8 | 3.4 |
| year | weak | 5.2 | 2.2 |
| noise:categories-5 | null control | -0.5 | 1.6 |
| shuffled:procedure:1 | null control | -0.0 | 1.2 |
| shuffled:legal_area:2 | null control | -0.3 | 0.7 |
| shuffled:procedure:2 | null control | -1.5 | 0.6 |
| shuffled:year:2 | null control | -0.9 | 0.5 |
| shuffled:legal_subarea:1 | null control | 0.9 | 0.4 |
| noise:numeric-0 | null control | 2.4 | 0.3 |
| shuffled:procedure:0 | null control | -0.5 | 0.2 |
| shuffled:legal_subarea:0 | null control | -0.8 | 0.2 |
| shuffled:year:0 | null control | -0.7 | 0.1 |
| summary_words | length | 172.2 | 0.0 |
| noise:categories-12 | null control | 2.1 | -0.0 |
| noise:numeric-1 | null control | 1.9 | -0.1 |
| shuffled:legal_area:0 | null control | -0.3 | -0.1 |
| shuffled:legal_subarea:2 | null control | 0.0 | -0.2 |
| shuffled:year:1 | null control | -0.1 | -0.6 |
| shuffled:legal_area:1 | null control | 0.9 | -0.6 |
| shuffled:court_type:2 | null control | -1.5 | -1.0 |
| shuffled:court_type:1 | null control | 0.7 | -1.0 |
| noise:categories-3 | null control | -0.9 | -1.9 |
| noise:numeric-2 | null control | -0.4 | -3.0 |

| grade | naive | length-controlled |
|---|---:|---:|
| strong_above_all_nulls | True | True |
| auc_strong_vs_null | 1.00 | 1.00 |
| auc_strong_moderate_vs_null | 1.00 | 1.00 |
| null_false_positive_rate_z3 | 0.00 | 0.05 |
| null_max_z | 2.40 | 3.37 |
| length_below_all_strong | True | True |

**Text field `ruling_excerpt`**

| column | expected | z naive | z length-controlled |
|---|---:|---:|---:|
| legal_area | strong | 919.9 | 598.1 |
| year | weak | 308.5 | 107.7 |
| court_type | moderate | 473.4 | 60.8 |
| ruling_words | length | 124.3 | 60.8 |
| court | weak | 195.5 | 56.5 |
| legal_subarea | strong | 618.1 | 42.2 |
| ecli_sequence | uncertain | 72.6 | 37.3 |
| procedure | moderate | 81.5 | 36.5 |
| summary_words | length | 44.6 | 25.9 |
| shuffled:procedure:0 | null control | -1.3 | 2.5 |
| noise:numeric-1 | null control | -0.3 | 1.9 |
| shuffled:procedure:2 | null control | -0.5 | 0.6 |
| shuffled:court_type:2 | null control | 0.9 | 0.4 |
| shuffled:procedure:1 | null control | -0.4 | 0.3 |
| shuffled:legal_subarea:1 | null control | -0.6 | 0.3 |
| noise:categories-5 | null control | 1.9 | 0.3 |
| shuffled:legal_subarea:2 | null control | -0.1 | 0.2 |
| shuffled:year:1 | null control | 0.1 | -0.1 |
| noise:numeric-0 | null control | 0.6 | -0.3 |
| shuffled:legal_area:1 | null control | -1.4 | -0.4 |
| shuffled:legal_subarea:0 | null control | -1.2 | -0.4 |
| noise:categories-12 | null control | 0.8 | -0.5 |
| shuffled:court_type:0 | null control | 2.9 | -0.6 |
| noise:categories-3 | null control | -0.7 | -0.8 |
| shuffled:court_type:1 | null control | -1.1 | -0.9 |
| shuffled:legal_area:0 | null control | 0.0 | -0.9 |
| shuffled:year:2 | null control | -0.7 | -1.1 |
| shuffled:year:0 | null control | -0.6 | -1.1 |
| shuffled:legal_area:2 | null control | -0.4 | -1.2 |
| noise:numeric-2 | null control | 1.0 | -1.3 |

| grade | naive | length-controlled |
|---|---:|---:|
| strong_above_all_nulls | True | True |
| auc_strong_vs_null | 1.00 | 1.00 |
| auc_strong_moderate_vs_null | 1.00 | 1.00 |
| null_false_positive_rate_z3 | 0.00 | 0.00 |
| null_max_z | 2.91 | 2.49 |
| length_below_all_strong | True | False |

## Do phrase descriptions explain a group?

**Text field `summary`** (held-out, top 10 phrases)

| ranking | AUC fine | AUC coarse | AUC null | AUC length | precision fine | coverage fine | precision null |
|---|---:|---:|---:|---:|---:|---:|---:|
| frequency | 0.715 | 0.638 | 0.505 | 0.533 | 0.43 | 0.79 | 0.26 |
| balanced | 0.701 | 0.641 | 0.505 | 0.533 | 0.40 | 0.78 | 0.25 |
| ctfidf | 0.732 | 0.648 | 0.502 | 0.546 | 0.46 | 0.78 | 0.25 |
| contrast | 0.777 | 0.726 | 0.494 | 0.604 | 0.62 | 0.67 | 0.24 |
| lift | 0.733 | 0.710 | 0.497 | 0.539 | 0.85 | 0.47 | 0.23 |

**Text field `ruling_excerpt`** (held-out, top 10 phrases)

| ranking | AUC fine | AUC coarse | AUC null | AUC length | precision fine | coverage fine | precision null |
|---|---:|---:|---:|---:|---:|---:|---:|
| frequency | 0.890 | 0.880 | 0.503 | 0.733 | 0.16 | 1.00 | 0.25 |
| balanced | 0.800 | 0.845 | 0.501 | 0.628 | 0.27 | 0.99 | 0.25 |
| ctfidf | 0.928 | 0.903 | 0.494 | 0.715 | 0.28 | 1.00 | 0.25 |
| contrast | 0.959 | 0.960 | 0.497 | 0.751 | 0.43 | 1.00 | 0.24 |
| lift | 0.859 | 0.941 | 0.498 | 0.560 | 0.94 | 0.72 | 0.22 |

Examples, `summary`

| group | held-out AUC | top contrast phrases |
|---|---:|---:|
| coarse:Bestuursrecht | 0.79 | besluit, beroep, verweerder, college, omgevingsvergunning, appellant, aanvraag |
| coarse:Civiel recht | 0.61 | bw, werknemer, verzoek, werkgever, arbeidsovereenkomst, gedaagde, kort geding |
| coarse:Strafrecht | 0.78 | verdachte, hof, maatregel, gevangenisstraf, terbeschikkingstelling, beslissing, jaar |
| fine:Arbeidsrecht | 0.86 | werknemer, werkgever, arbeidsovereenkomst, ontslag, staande voet, voet, ontslag op staande |
| fine:Belastingrecht | 0.66 | belanghebbende, eiseres, inspecteur, geschil, woz, beroep, inkomen |
| fine:Insolventierecht | 0.85 | fw, schuldsaneringsregeling, wsnp, verzoek, schulden, toelating, lid |
| fine:Intellectueel-eigendomsrecht | 0.79 | inbreuk, eigendom, intellectuele eigendom, auteursrecht, kort geding, octrooi, kort |
| fine:Materieel strafrecht | 0.79 | verdachte, gevangenisstraf, maanden, veroordeling, poging, voorwaardelijk, rechtbank |
| fine:Omgevingsrecht | 0.88 | omgevingsvergunning, college, perceel, verleend, besluit, locatie, omgevingsvergunning verleend |
| fine:Penitentiair strafrecht | 0.80 | hof, terbeschikkingstelling, maatregel, terbeschikkinggestelde, verlenging, termijn, zal |
| fine:Personen- en familierecht | 0.71 | gezag, man, 1, bw, moeder, ondertoezichtstelling, verzoek |
| fine:Socialezekerheidsrecht | 0.82 | appellant, appellante, uitkering, uwv, terecht, geen, niet |
| fine:Strafprocesrecht | 0.79 | verdachte, beslissing, wrakingsverzoek, hof, rechter, betrokkene, wraking |
| fine:Verbintenissenrecht | 0.64 | vordering, gedaagde, overeenkomst, partij, procedure, eiseres, partijen |
| fine:Vreemdelingenrecht | 0.73 | vreemdeling, besluit, staatssecretaris, eiser, verblijfsvergunning, asiel, bepaalde tijd |
| length:longest-quartile | 0.60 | verdachte, gevangenisstraf, maanden, poging, voorwaardelijk, inbreuk, mishandeling |

Examples, `ruling_excerpt`

| group | held-out AUC | top contrast phrases |
|---|---:|---:|
| coarse:Bestuursrecht | 0.99 | uitspraak, besluit, verweerder, college, beroep, eiser, belanghebbende |
| coarse:Civiel recht | 0.93 | 2, gedaagde, producties, hierna, 1, procedure, noemen |
| coarse:Strafrecht | 0.96 | verdachte, of, officier van justitie, justitie, beslissing, terechtzitting, slachtoffer |
| fine:Arbeidsrecht | 0.99 | arbeidsovereenkomst, werknemer, verzoekster, 2, 1, kantonrechter, verweerster |
| fine:Belastingrecht | 0.98 | belanghebbende, inspecteur, uitspraak, heffingsambtenaar, bezwaar, aanslag, beroep |
| fine:Insolventierecht | 0.95 | schuldsaneringsregeling, bewindvoerder, verzoekster, verzoeker, schuldeisers, fw, verzoek |
| fine:Intellectueel-eigendomsrecht | 0.94 | producties, c, gedaagde, v, b, s, akte |
| fine:Materieel strafrecht | 0.97 | verdachte, of, slachtoffer, officier van justitie, justitie, terechtzitting, feit |
| fine:Omgevingsrecht | 0.99 | college, besluit, omgevingsvergunning, uitspraak, perceel, verweerder, appellant |
| fine:Penitentiair strafrecht | 0.92 | terbeschikkinggestelde, beslissing, hof, verdachte, of, maatregel, terbeschikkingstelling |
| fine:Personen- en familierecht | 0.97 | minderjarige, moeder, beschikking, vader, noemen, hierna te noemen, vrouw |
| fine:Socialezekerheidsrecht | 0.98 | besluit, uwv, appellante, appellant, uitspraak, uitkering, raad |
| fine:Strafprocesrecht | 0.92 | betrokkene, verdachte, beslissing, rechter, of, officier van justitie, kantonrechter |
| fine:Verbintenissenrecht | 0.92 | gedaagde, 2, geïntimeerde, 1, procedure, vonnis, producties |
| fine:Vreemdelingenrecht | 0.98 | eiser, vreemdeling, staatssecretaris, uitspraak, verweerder, besluit, niet |
| length:longest-quartile | 0.75 | of, producties, verdachte, 1, slachtoffer, 2, vonnis |

## Clusters and maps, `summary`

| run | clusters | unassigned | legal_area ARI / NMI | legal_subarea ARI / NMI | procedure ARI / NMI | court_type ARI / NMI | year ARI / NMI | length quartile ARI / NMI | shuffled fine ARI / NMI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| minibatch (coarse, k=3) | 3 | 0% | 0.12 / 0.19 | 0.05 / 0.16 | 0.03 / 0.10 | 0.00 / 0.09 | 0.00 / 0.00 | 0.01 / 0.03 | 0.00 / 0.01 |
| minibatch (fine, k=12) | 12 | 0% | 0.08 / 0.22 | 0.16 / 0.32 | 0.03 / 0.17 | 0.03 / 0.16 | 0.00 / 0.02 | 0.02 / 0.05 | 0.00 / 0.02 |
| agglomerative (coarse, k=3) | 3 | 0% | 0.13 / 0.20 | 0.04 / 0.16 | 0.00 / 0.08 | 0.06 / 0.08 | -0.00 / 0.00 | 0.01 / 0.04 | 0.00 / 0.01 |
| agglomerative (fine, k=12) | 12 | 0% | 0.09 / 0.23 | 0.15 / 0.34 | 0.03 / 0.17 | 0.05 / 0.20 | -0.00 / 0.02 | 0.02 / 0.06 | 0.00 / 0.02 |
| hdbscan (density) | 17 | 54% | 0.06 / 0.26 | 0.04 / 0.35 | 0.00 / 0.20 | 0.10 / 0.22 | 0.00 / 0.05 | 0.01 / 0.08 | -0.00 / 0.04 |

| representation | kNN purity coarse | kNN purity fine |
|---|---:|---:|
| 32-d text vectors | 0.76 (chance 0.35) | 0.50 (chance 0.08) |
| PCA (2-d) | 0.50 (chance 0.35) | 0.20 (chance 0.09) |
| SVD (2-d) | 0.48 (chance 0.35) | 0.18 (chance 0.08) |
| UMAP (2-d) | 0.75 (chance 0.34) | 0.48 (chance 0.08) |

## Clusters and maps, `ruling_excerpt`

| run | clusters | unassigned | legal_area ARI / NMI | legal_subarea ARI / NMI | procedure ARI / NMI | court_type ARI / NMI | year ARI / NMI | length quartile ARI / NMI | shuffled fine ARI / NMI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| minibatch (coarse, k=3) | 3 | 0% | 0.59 / 0.71 | 0.25 / 0.55 | 0.10 / 0.19 | 0.01 / 0.13 | -0.00 / 0.00 | 0.05 / 0.06 | -0.00 / 0.00 |
| minibatch (fine, k=12) | 12 | 0% | 0.33 / 0.58 | 0.57 / 0.75 | 0.10 / 0.31 | 0.11 / 0.35 | -0.00 / 0.02 | 0.05 / 0.11 | 0.00 / 0.02 |
| agglomerative (coarse, k=3) | 3 | 0% | 0.54 / 0.66 | 0.23 / 0.50 | 0.10 / 0.23 | 0.08 / 0.26 | -0.00 / 0.00 | 0.02 / 0.04 | 0.00 / 0.01 |
| agglomerative (fine, k=12) | 12 | 0% | 0.30 / 0.57 | 0.48 / 0.69 | 0.15 / 0.37 | 0.15 / 0.44 | 0.00 / 0.02 | 0.05 / 0.10 | -0.00 / 0.02 |
| hdbscan (density) | 21 | 18% | 0.20 / 0.45 | 0.34 / 0.63 | 0.09 / 0.41 | 0.18 / 0.48 | 0.00 / 0.06 | 0.04 / 0.12 | -0.00 / 0.04 |

| representation | kNN purity coarse | kNN purity fine |
|---|---:|---:|
| 32-d text vectors | 0.99 (chance 0.35) | 0.84 (chance 0.08) |
| PCA (2-d) | 0.98 (chance 0.35) | 0.46 (chance 0.08) |
| SVD (2-d) | 0.94 (chance 0.35) | 0.42 (chance 0.08) |
| UMAP (2-d) | 0.99 (chance 0.34) | 0.84 (chance 0.09) |
