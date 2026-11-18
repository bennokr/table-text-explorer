# Local synthetic RMC workload

Run `npm run prepare:rmc` to create `fixtures/RMC_synthetic_1000.xlsx` from the
existing fictional seed workbook and fictional Dutch text bank. No network, model
fitting or runtime LLM calls are involved. The original workbook is preserved.
Run `npm run dev` to refresh the local Examples menu; production builds exclude
all private fixtures, text banks and reports.

The currently available seed workbook contains 20 records. Structured participant
profiles are sampled as whole rows to retain their combinations and missingness,
then identifiers are replaced, age/gestation/year are jittered within codebook
bounds, and explicit birth-history/routing checks are applied. Topic profiles
introduce probabilistic associations among experience ratings, related questions
and text-field choices. They are fictional testing assumptions, not estimates of
the real RMC population. Demographics do not determine discrimination responses.

The known aggregate is 14,000 text strings per 12,000 participants. At 1,000 records,
the generator targets 1,167 populated text cells. Three presets share that total:

| Preset | No text | At least one text | Maximum text cells per person |
| --- | ---: | ---: | ---: |
| baseline | 450 | 550 | 6 |
| spread | 300 | 700 | 4 |
| concentrated | 600 | 400 | 7 |

The baseline allocates 250 people one text, 170 two texts, 80 four texts, 43 five
texts and seven six texts. These are deliberately uneven examples, not measured
frequencies. The earlier discussion's illustrative table summed to 1,207; the
implemented baseline corrects that arithmetic while preserving 450 zero-text rows.
Other record counts use proportional rounding and adjust to the same overall ratio.

```
npm run prepare:rmc -- --scenario spread
npm run prepare:rmc -- --scenario concentrated --seed 42
npm run prepare:rmc -- --rows 1000 --seed-file fixtures/your-synthetic-100.xlsx
```

Defaults, field weights, topic profiles and explicit binary-answer mappings live
in [scripts/rmc-synthesis.json](../scripts/rmc-synthesis.json). More general text
fields and communication/support fields get higher weights; specialized fields
have a long tail. Every one of the 37 `…Toel` fields receives at least one example
when the available text slots permit. `ErvTkst` requires a previous birth. Follow-up
texts agree with their parent answer; generated group indicators reflect their
child answers. Exact real questionnaire routing beyond these checks remains an
approximation, including known ambiguities in the source codebook.

The local `fixtures/rmc-synthetic/` folder contains the seed bank and 120 targeted
answer-compatible additions. They cover 39 of 52 text fields; the remaining 13
category-specific/specialized text fields stay empty. Responses are composed from
one to three examples with the same compatible parent answer. The sampler prefers
unused compositions; it never appends record IDs or meaningless suffixes. Distinct
strings still reuse language: this is suitable for UI/performance/coverage testing,
not validation of real phrase frequencies, topic prevalence or model accuracy.

Each run saves rows, aggregate diagnostics and source-response lineage in a nested
folder under `fixtures/rmc-synthetic/`, so these JSON files do not become dataset
examples. Diagnostics include text-cell counts per person and field, duplicate
strings, lengths, category frequencies, missingness and experience ratings by
fictional topic profile. The row hash checks reproducibility with the same seed,
configuration, workbook and text banks. Generated Table Schema and demo settings
live under `demo-config/<workbook-name>/` and use the [codebook profile](codebook-profile.md) (free-text fields are the string columns other than the identifier and postcode); all 39 populated text fields are selected
for phrase counting by default.

`npm run test:rmc` checks totals, alternate scenarios, deterministic generation,
conditional text assignment and input preservation using invented in-memory seeds.
Python uses only its standard library. A tiny Node bridge reuses the application's
existing XLSX dependency for workbook input/output.
