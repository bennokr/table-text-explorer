# Lexicon

One folder per language (`nl`, `en`), four plain-text files each. One entry per line, lowercase, `#` starts a comment.
The files are bundled with the app (`src/lexicon.js`), sent to the worker with every phrase-index request, and read by
the Python checks (`tests/lexicon_reader.py`).

| File | What its words may do |
|---|---|
| `stop.txt` | Sit inside a phrase ("zorg voor kinderen"), never stand alone, never start or end one. Function words: articles, pronouns, prepositions, conjunctions, auxiliary verbs. |
| `lead.txt` | Start a phrase or sit inside one ("zonder suiker", "heel goed"), never stand alone, never end one. Words that change what follows: quantifiers, degree and frequency words. |
| `negation.txt` | Be anything: negations are kept as phrases of their own ("niet", "geen"), because they flip the meaning of a review or a motion. Cluster names avoid them at their edges. |
| `fold.txt` | Not a word list: suffix rules that give inflected forms one key (boek/boeken). See the header of `nl/fold.txt`. |

A word belongs to one tier only (a test checks it). The user's own "Additional stopwords" are added to `stop`.
Choosing "Dutch + English" joins the word lists; folding then uses the first language's rules, because suffix rules of
two languages would clash.

## What folding is for

The key is used in two places and nowhere else: when "Reduce redundant phrases" merges phrases of one list that are
variants of each other (the better-scoring form is kept), and when cluster names avoid repeating a word that another
name already uses. It never changes what is shown, counted, filtered or queried, so a click on "boek" still filters
exactly "boek". It is deliberately light: it will merge a few unrelated words (wet/weten) and miss irregular forms
(vinden/vond). `docs/evaluation-lexicon.md` measures what it does on the examples.

## Adding a language

Add `src/lexicon/<code>/` with the four files, and an option with that code to the Stoplist select in `index.html`.
Start from the closest language; `tests/check_fold.py` shows how to test the folding rules with word groups.
