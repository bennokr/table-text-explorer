# Lexicon evaluation: variants and empty words

The phrase index, the clouds and the cluster names used a 38-word Dutch stoplist (negations kept), no lead words and no
folding, with a separate 90-word list for names. They now use the lexicon in `src/lexicon/<code>/`: `stop`, `lead` and
`negation` word lists and `fold` rules (see `src/lexicon/README.md`). This page measures the difference on the three
examples.

## Method

`tests/eval/lexicon_report.py` builds the text index of each example twice, once with the previous settings and once with
`src/lexicon/nl`, then takes the example's shipped clustering (8 clusters, `demo-config/<table>/results.json`) and, for
each cluster, the top 15 distinctive phrases (contrast ranking, support 2, redundant phrases reduced) and the cluster's
name (four phrases, as the app names it). It also takes the 15 most common phrases of the whole table. Fields: `text`
(DBRD), `summary` (Rechtspraak), `text` (Tweede Kamer), n-grams of one to three words.

Both settings are measured with the **same yardstick, the new lexicon**: a *variant pair* is two phrases of one list with
the same folded key (boek/boeken); an *empty-word phrase* is one that is a stop or lead word alone, starts with a stop
word or ends with a stop or lead word. The yardstick is also what "after" is built from, so those counts fall to zero by
construction: the finding is the "before" column, which says how many such phrases the old settings produced. One number
does not use the lexicon: word pairs that share their first five letters, an upper bound on inflections the folding
may not see (it also counts unrelated words such as onderwijs/onderwerp).

## Results

| table | measure | before | after |
|---|---|---:|---:|
| dbrd-test.json | variant pairs per cluster cloud | 0.625 | 0 |
| dbrd-test.json | clusters with a variant pair | 5 | 0 |
| dbrd-test.json | word pairs sharing a 5-letter prefix per cluster cloud (proxy) | 0.5 | 0.375 |
| dbrd-test.json | empty-word phrases per cluster cloud | 5.125 | 0 |
| dbrd-test.json | empty-word phrases in the common cloud | 10 | 0 |
| dbrd-test.json | negation phrases in the common cloud | 1 | 2 |
| dbrd-test.json | words repeated across names | boek, gat, lev, verhal, vond | boek, gelez, lev, verhal, vond |
| dbrd-test.json | name phrases with an empty edge word | 8 | 0 |
| rechtspraak-sample.json | variant pairs per cluster cloud | 0 | 0 |
| rechtspraak-sample.json | clusters with a variant pair | 0 | 0 |
| rechtspraak-sample.json | word pairs sharing a 5-letter prefix per cluster cloud (proxy) | 0.625 | 0.625 |
| rechtspraak-sample.json | empty-word phrases per cluster cloud | 0.125 | 0 |
| rechtspraak-sample.json | empty-word phrases in the common cloud | 6 | 0 |
| rechtspraak-sample.json | negation phrases in the common cloud | 2 | 2 |
| rechtspraak-sample.json | words repeated across names | besluit | besluit |
| rechtspraak-sample.json | name phrases with an empty edge word | 0 | 0 |
| tweedekamer-motions-sample.json | variant pairs per cluster cloud | 0.5 | 0 |
| tweedekamer-motions-sample.json | clusters with a variant pair | 4 | 0 |
| tweedekamer-motions-sample.json | word pairs sharing a 5-letter prefix per cluster cloud (proxy) | 1.375 | 0.875 |
| tweedekamer-motions-sample.json | empty-word phrases per cluster cloud | 1.125 | 0 |
| tweedekamer-motions-sample.json | empty-word phrases in the common cloud | 9 | 0 |
| tweedekamer-motions-sample.json | negation phrases in the common cloud | 2 | 2 |
| tweedekamer-motions-sample.json | words repeated across names | none | none |
| tweedekamer-motions-sample.json | name phrases with an empty edge word | 0 | 0 |

## Reading the results

- **Empty words.** The old lists left 10, 6 and 9 empty-word phrases in the 15 most common phrases of the three
  examples ("of", "deze", "over", "wat", "ze", "al", "hoe", "kan", "alle"…), and about five per cluster cloud in DBRD
  (reviews are full of "ben", "mijn", "gaat"). The names had 8 phrases of DBRD with an empty edge word under the new
  rules ("ben", "mijn", "komt", "staat", "echt").
- **Negations survive.** "niet" and "geen" are still in the common clouds (DBRD 1 to 2, the others unchanged at 2),
  now as phrases of their own and no longer pushed out by empty words.
- **Variants.** Before, 5 of 8 DBRD clusters and 4 of 8 Tweede Kamer clusters had two forms of one word among their
  top 15 phrases (boek/boeken, onderzoek/onderzoeken, maatregel/maatregelen). After, none. The prefix proxy falls from
  0.5 to 0.375 (DBRD) and from 1.375 to 0.875 (Tweede Kamer) pairs per cloud and stays at 0.625 in Rechtspraak,
  where the remaining pairs are mostly different words (omgevingsvergunning/omgevingsrecht).
- **Names.** The folding does not make names unique. DBRD names still repeat boek/boeken, "vond" (a form of "vinden",
  which suffix rules cannot see), "gelezen" and "leven"/"verhaal": every cluster is about books, so the strict names
  (which share no word) run out and the looser fallback, which allows repeats, is used. Rechtspraak repeats "besluit"
  for the same reason. Tweede Kamer names have no repeats.
- **Not measured:** whether the merged phrase is the one a reader would prefer (the better-scoring form is kept), and
  English (the lists and rules exist and are unit-tested, but no English example ships).

## Names and clouds, before and after

### dbrd-test.json

before names: leuk · zelf · maken · eten; lezer · leven · komt · auteur; boeken · vond · gelezen · ben; boek · lezen · mijn · vond; verhaal · vond · personages · echt; oorlog · tweede · wereld · staat; moord · onderzoek · gaat · thriller; leven · verhaal · gaat · moeder
before common cloud: boek, niet, verhaal, wat, over, wel, nog, ze, meer, al, haar, lezen, zo, goed, deze

after names: leuk · maken · eten · keer; lezer · leven · auteur · maakt; boeken · vond · gelezen · uitgelezen; boek · lezen · vond · gelezen; verhaal · vond · personages · spannend; oorlog · tweede · wereld · geschiedenis; moord · onderzoek · thriller · snel; leven · verhaal · moeder · elkaar
after common cloud: boek, niet, verhaal, lezen, goed, geen, leven, eerste, weer, elkaar, mee, personages, geschreven, iets, weet


### rechtspraak-sample.json

before names: staatssecretaris · besluit · vreemdeling · asiel; inbreuk · auteursrecht · intellectuele · eigendom; werkgever · werknemer · arbeidsovereenkomst · vergoeding; hr · ro · cassatie · verklaart; beroep · verzoek · afgewezen · artikel; omgevingsvergunning · college · besluit · verleend; termijn · verlenging · jaar · beslissing; verdachte · gevangenisstraf · maanden · veroordeling
before common cloud: niet, geen, beroep, artikel, worden, afgewezen, of, verzoek, besluit, lid, deze, kan, omdat, ten, over

after names: staatssecretaris · besluit · vreemdeling · asiel; inbreuk · auteursrecht · intellectuele · eigendom; werkgever · werknemer · arbeidsovereenkomst · vergoeding; hr · ro · cassatie · verklaart; beroep · verzoek · afgewezen · artikel; omgevingsvergunning · college · besluit · verleend; termijn · verlenging · jaar · beslissing; verdachte · gevangenisstraf · maanden · veroordeling
after common cloud: niet, geen, beroep, artikel, afgewezen, verzoek, besluit, lid, ten, sprake, oordeel, grond, vordering, verdachte, gemaakt


### tweedekamer-motions-sample.json

before names: kamer · aanpak · plan · informeren; financiële · sociale · budget · woningen; energie · gebruik · co2 · maatregelen; onderzoek · zorg · medische · onderzoeken; onderwijs · kinderen · studenten · scholen; asielzoekers · minister · sancties · defensie; nederlandse · nederland · eu · europese; wet · verbod · artikel · wetgeving
before common cloud: over, niet, worden, onderzoek, of, geen, maken, onderzoeken, alle, laten, hoe, kunnen, meer, mogelijk, kan

after names: kamer · aanpak · plan · informeren; financiële · sociale · budget · woningen; energie · gebruik · co2 · maatregelen; onderzoek · zorg · medische · mensen; onderwijs · kinderen · studenten · scholen; asielzoekers · minister · sancties · defensie; nederlandse · nederland · eu · europese; wet · verbod · artikel · wetgeving
after common cloud: niet, onderzoek, geen, maken, mogelijk, brengen, nederlandse, nederland, maatregelen, nieuwe, plan, aanpak, europese, uitspreken, zorg
