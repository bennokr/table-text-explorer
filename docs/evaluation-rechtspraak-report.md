# rechtspraak evaluation

2360 records. Gold manifest revision 2. 12 sub-areas (160-200 each), 10 years, court types {'Rechtbank': 1415, 'Gerechtshof': 532, 'Raad van State': 144, 'Centrale Raad van Beroep': 144, 'Overig': 73, 'Hoge Raad': 52}, 23 courts. Median words: {'summary_words': 27, 'ruling_words': 1968}.

## Which columns does the text vary with?

**Text field `summary`**

| column | class | skill beyond length | skill total | length alone explains | p vs nulls |
|---|---:|---:|---:|---:|---:|
| legal_area | strong | 0.734 | 0.743 | 0.03 | 0.027 |
| legal_subarea | strong | 0.664 | 0.673 | 0.03 | 0.027 |
| court_type | moderate | 0.497 | 0.522 | 0.05 | 0.027 |
| procedure | moderate | 0.294 | 0.300 | 0.01 | 0.027 |
| court | weak | 0.259 | 0.279 | 0.03 | 0.027 |
| ruling_words | structure | 0.140 | 0.148 | 0.01 | 0.027 |
| ecli_sequence | uncertain | 0.044 | 0.040 | -0.00 | 0.027 |
| year | weak | -0.020 | -0.021 | -0.00 | 0.162 |
| summary_words | length | n/a | 0.998 | 1.00 (determined) | n/a |
| null controls (n=36) | null | -0.046 ± 0.020 (max -0.014) |  |  |  |

| grade | result |
|---|---:|
| strong columns beat every null | True |
| p = 0.05 resolvable with this many nulls | True |
| AUC strong vs null | 1.00 |
| AUC strong+moderate vs null | 1.00 |
| length columns detected beyond length | none |
| columns determined by length (not scored) | ['summary_words'] |

**Text field `ruling_excerpt`**

| column | class | skill beyond length | skill total | length alone explains | p vs nulls |
|---|---:|---:|---:|---:|---:|
| legal_area | strong | 0.990 | 0.991 | 0.03 | 0.027 |
| court_type | echoed | 0.973 | 0.974 | 0.04 | 0.027 |
| legal_subarea | strong | 0.898 | 0.901 | 0.03 | 0.027 |
| court | echoed | 0.820 | 0.821 | 0.01 | 0.027 |
| procedure | moderate | 0.636 | 0.646 | 0.03 | 0.027 |
| year | echoed | 0.362 | 0.356 | -0.01 | 0.027 |
| ruling_words | structure | 0.224 | 0.247 | 0.03 | 0.027 |
| ecli_sequence | uncertain | 0.123 | 0.120 | -0.00 | 0.027 |
| summary_words | structure | 0.075 | 0.080 | 0.01 | 0.027 |
| null controls (n=36) | null | -0.041 ± 0.017 (max -0.014) |  |  |  |

| grade | result |
|---|---:|
| strong columns beat every null | True |
| p = 0.05 resolvable with this many nulls | True |
| AUC strong vs null | 1.00 |
| AUC strong+moderate vs null | 1.00 |
| length columns detected beyond length | none |
| columns determined by length (not scored) | none |

## Do phrase descriptions explain a group?

**Text field `summary`** (held-out, top 10 phrases)

| ranking | AUC fine | AUC coarse | AUC null | AUC length | precision fine | coverage fine | precision null |
|---|---:|---:|---:|---:|---:|---:|---:|
| frequency | 0.709 | 0.627 | 0.501 | 0.528 | 0.42 | 0.78 | 0.25 |
| balanced | 0.712 | 0.629 | 0.500 | 0.508 | 0.42 | 0.78 | 0.25 |
| ctfidf | 0.729 | 0.635 | 0.499 | 0.534 | 0.50 | 0.76 | 0.25 |
| contrast | 0.789 | 0.739 | 0.504 | 0.630 | 0.67 | 0.68 | 0.27 |
| lift | 0.734 | 0.713 | 0.501 | 0.522 | 0.90 | 0.47 | 0.26 |

**Text field `ruling_excerpt`** (held-out, top 10 phrases)

| ranking | AUC fine | AUC coarse | AUC null | AUC length | precision fine | coverage fine | precision null |
|---|---:|---:|---:|---:|---:|---:|---:|
| frequency | 0.890 | 0.875 | 0.501 | 0.688 | 0.15 | 1.00 | 0.25 |
| balanced | 0.808 | 0.860 | 0.495 | 0.619 | 0.25 | 0.99 | 0.25 |
| ctfidf | 0.927 | 0.914 | 0.503 | 0.713 | 0.28 | 1.00 | 0.25 |
| contrast | 0.962 | 0.971 | 0.498 | 0.730 | 0.43 | 1.00 | 0.25 |
| lift | 0.852 | 0.931 | 0.501 | 0.533 | 0.96 | 0.71 | 0.25 |

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

## Clusters and maps, `summary`

| run | clusters | unassigned | legal_area ARI / NMI | legal_subarea ARI / NMI | procedure ARI / NMI | court_type ARI / NMI | year ARI / NMI | length quartile ARI / NMI | shuffled fine ARI / NMI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| minibatch (coarse, k=3) | 3 | 0% | 0.18 / 0.22 | 0.07 / 0.18 | 0.03 / 0.10 | 0.00 / 0.06 | -0.00 / 0.00 | 0.02 / 0.04 | -0.00 / 0.00 |
| minibatch (fine, k=12) | 12 | 0% | 0.14 / 0.30 | 0.27 / 0.42 | 0.05 / 0.19 | 0.02 / 0.16 | 0.00 / 0.02 | 0.03 / 0.06 | 0.00 / 0.01 |
| agglomerative (coarse, k=3) | 3 | 0% | 0.11 / 0.23 | 0.02 / 0.18 | 0.02 / 0.10 | 0.06 / 0.13 | 0.00 / 0.00 | 0.01 / 0.05 | 0.00 / 0.00 |
| agglomerative (fine, k=12) | 12 | 0% | 0.12 / 0.27 | 0.17 / 0.38 | 0.04 / 0.19 | 0.05 / 0.19 | 0.00 / 0.01 | 0.03 / 0.08 | 0.00 / 0.01 |
| hdbscan (density) | 27 | 54% | 0.04 / 0.27 | 0.05 / 0.39 | 0.02 / 0.23 | 0.09 / 0.24 | 0.00 / 0.04 | 0.01 / 0.09 | -0.00 / 0.03 |

| representation | kNN purity coarse | kNN purity fine |
|---|---:|---:|
| 32-d text vectors | 0.82 (chance 0.35) | 0.58 (chance 0.09) |
| PCA (2-d) | 0.51 (chance 0.36) | 0.21 (chance 0.08) |
| SVD (2-d) | 0.50 (chance 0.35) | 0.19 (chance 0.09) |
| UMAP (2-d) | 0.80 (chance 0.35) | 0.56 (chance 0.08) |

## Clusters and maps, `ruling_excerpt`

| run | clusters | unassigned | legal_area ARI / NMI | legal_subarea ARI / NMI | procedure ARI / NMI | court_type ARI / NMI | year ARI / NMI | length quartile ARI / NMI | shuffled fine ARI / NMI |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| minibatch (coarse, k=3) | 3 | 0% | 0.80 / 0.76 | 0.22 / 0.50 | 0.07 / 0.17 | 0.06 / 0.15 | -0.00 / 0.00 | 0.03 / 0.04 | -0.00 / 0.00 |
| minibatch (fine, k=12) | 12 | 0% | 0.27 / 0.55 | 0.48 / 0.68 | 0.13 / 0.35 | 0.15 / 0.43 | 0.00 / 0.02 | 0.06 / 0.10 | -0.00 / 0.01 |
| agglomerative (coarse, k=3) | 3 | 0% | 0.58 / 0.69 | 0.24 / 0.50 | 0.10 / 0.23 | 0.08 / 0.27 | -0.00 / 0.00 | 0.03 / 0.04 | -0.00 / 0.00 |
| agglomerative (fine, k=12) | 12 | 0% | 0.33 / 0.59 | 0.49 / 0.69 | 0.17 / 0.38 | 0.15 / 0.44 | 0.00 / 0.02 | 0.05 / 0.10 | -0.00 / 0.01 |
| hdbscan (density) | 33 | 15% | 0.20 / 0.44 | 0.30 / 0.63 | 0.09 / 0.42 | 0.14 / 0.44 | 0.00 / 0.07 | 0.05 / 0.13 | -0.00 / 0.03 |

| representation | kNN purity coarse | kNN purity fine |
|---|---:|---:|
| 32-d text vectors | 0.99 (chance 0.35) | 0.86 (chance 0.09) |
| PCA (2-d) | 0.98 (chance 0.35) | 0.45 (chance 0.08) |
| SVD (2-d) | 0.94 (chance 0.35) | 0.39 (chance 0.08) |
| UMAP (2-d) | 0.99 (chance 0.35) | 0.85 (chance 0.08) |
