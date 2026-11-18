# Optional codebooks and demo defaults

Variable semantics use [Frictionless Table Schema 2](https://datapackage.org/standard/table-schema/).
The `.metadata.json` suffix is a naming convention: these files are Table Schema,
not CSVW. Standard properties include fields, logical types, titles, descriptions,
categories, categoriesOrdered, missingValues and constraints. Everything else comes from
[linked-codebook](https://github.com/bennokr/linked-codebook) and sits under the field property
`x-linked-codebook`: `level` (nominal, ordinal, ...), `group`, `identifying`, `unit`, `variable`
(a concept IRI), `values` (a label dictionary; with `closed` it is also written as `categories`) and
`applies_when` and `mappings`. A label dictionary does not imply that other values are invalid. Original cell values remain preserved.

## Spreadsheet profile

The workbook is the linked-codebook table format (see section 12 of its specification). All sheets have a single
header row, no merged cells or JSON cells. Only Columns is required. Blank cells mean unspecified; names match
exactly.

| Sheet | Columns |
| --- | --- |
| Columns | name; optional label, description, datatype, format, level, unit, unit_iri, variable, source, closed, missing_low, missing_high, completeness, applies_when, minimum, maximum, group, identifying |
| Values | column, code; optional label, description, missing |
| Mappings | column, match_type, object_id; optional code, object_label, confidence, provenance, retrieved_at, reviewer_id, description |
| Dataset | key, value: title, description, identifier, license, citation, access_rights, landing_page, rows |

`closed` belongs to the column: when true, Values lists every allowed code and becomes `categories`; when false or blank
it is a label dictionary. A code that means no value is a Values row with `missing` set (a row with no label is an
unlabelled missing code). There is no Missing sheet; blank cells are always missing. The order of the codes is the
order of the rows. Use actual Excel booleans for closed, missing and identifying. Format codes as Text in Excel to
preserve leading zeros. Datatype controls conversion of category codes: only integer/number codes become numbers.

The workbook is opened here, not in linked-codebook, and every cell is checked against the type its header expects.
A number where text is expected (Excel drops leading zeros), a date, a number stored as text, or a number where a
boolean is expected is reported as `codebook warning: <sheet> row <n>, <header>: ...`; `--strict` turns the warnings
into an error. Headers of the earlier workbook (`type`, `role`, `measurement`, `title`, the Missing, Groups and Review
sheets) are reported as unused. The earlier `x-role` text/code, the Groups titles, `primaryKey` (now `identifying`) and
the review notes have no place in the profile.

Convert an edited workbook without any network access:

```
node scripts/convert_codebook.mjs input-codebook.xlsx output.metadata.json [--strict]
```

A small, invented example is available as [Table Schema JSON](examples/codebook/schema.metadata.json)
and an equivalent [spreadsheet](examples/codebook/codebook.xlsx). It includes an
identifier, category labels, a partial ordinal dictionary, numeric bounds, text,
boolean and datetime columns. The converter and ordinary tests need no private files.

Local RMC profiles may exist under `demo-config/RMC*/` (the 20-row source and the three 1,000-row synthetic sets).
They and the original source workbook are ignored, not distributed. They are written in this profile: the 20-row
`codebook.xlsx` was rebuilt through `readCodebook` with `--strict` semantics and the schemas come from it, so groups
(`x-linked-codebook.group`) reach the grouped-mean embeddings. The earlier workbook's source rows, review notes and the
`pattern` constraint have no place in the profile and were dropped; `review.json` is a leftover of that profile.

## Labels

`label` is the short name shown in legends, pickers and cluster names (about six words); `description` is the full
question, which the sentence embeddings use as a prefix when "Include field descriptions" is on. For a multi-select
question, give each option column `label` "Question: option" and a `description` that repeats the question, because the
options are separate columns and would otherwise lose it. A follow-up (a "last" or comment column) should name its parent.
The local RMC codebook was relabelled this way: 195 columns, 30 of them options of multi-select questions.

## Routing and missingness

`applies_when` (a Columns header) is a condition in linked-codebook's language, for example `[gave_birth] = 1`. The
app keeps it as `appliesWhen` in a column's metadata and `src/routing.js` (`routingStates`) evaluates it with
linked-codebook's own parser, giving every cell one of `answered`, `asked_but_skipped` (blank, rule true),
`not_shown` (blank, rule false) or `unknown` (blank with no rule, or a rule that cannot be decided). Declared missing
codes count as blank. The source RMC codebook states very little routing:
`[ROUTING …]` on the twin/triplet answers of `Meerling` (it points at a block, `DEEL_1 Meerl`, that the workbook does not
contain), `[Vraag B]` on `SeksuGew` and `SeksuGewGed`, and "Radiobutton/Uitklap" (an unfolding screener) on `DreigAlgmn`
and `DiscrAlgmn`. The local RMC codebook turns the last two into rules (`SeksuGewGed` when `[SeksuGew] = 1`; the `Dreig*` and
`Discr*` questions, their `Last` and their `Toel`, when the screener is 1). The remaining 66 rules are inferences, not
statements of the questionnaire: a `…Last` follow-up ("Had je hier last van?") for the answer that signals a problem, a `…Toel`
comment box for anyone who answered the item (the codebook marks every `…Toel` as not required), `ModPartVag`/`ModPartKeiz` by
`ModPart`, and `ErvEerst`…`ErvNegen` by `NrBev`. They match the synthetic data, which was generated with those rules, and
need checking against the producing system before they are used on real responses.

When at least one column has a rule, loading the table adds five read-only computed columns per record: **Answered**,
**Skipped** (asked but left blank), **Not shown**, **Text answers** (answered text columns) and **Has text**
(`src/response-profile.js`). Colour a map or chart by them to see whether routing or response counts explain a layout. They are
not analysis inputs or phrase columns, ignore the column-type dialog, and are included in exports. Tables without rules get none.

## Demo loading

Each known demo has its own `demo-config/<filename>/schema.metadata.json` and a short
`demo.json` containing version, analysis defaults and initial view configurations.
Native SAV metadata is retained when the sidecar does not override a property.
Metadata is loaded only through the example picker; a same-named uploaded file is
an ordinary import. Imports start from generic analysis defaults to prevent leakage
between datasets. No configuration triggers automatic fitting.

Preparation copies descriptors only for datasets included in that build. Private
fixtures and their demo descriptors stay out of production builds. The generated
examples manifest names each dataset's descriptor URLs. Generated metadata in
public/demos is ignored. Dataset licenses and acquisition provenance remain in their
existing attribution manifests, separate from variable metadata and UI defaults.

This stage provides examples, conversion and demo consumption. A general codebook
upload/review UI is future work. The adapter uses supported types/labels; it does not
claim full Table Schema validation or implement arbitrary type/format transformations.

## Import and inference

Object/array-valued columns are omitted as a whole on import unless the user chooses Flatten in the import dialog
(see help "Nested JSON"), reported by name in ignoredFields and by count in the status bar. Remaining scalar values are untouched.
`\N` is a missing marker for inference, queries and numeric analysis, consistent
with the existing lexical and embedding tokenizers. Zero and false remain values.

Explicit metadata and user type overrides precede inference. Otherwise sparse
strings and sentence-like text are not assumed categorical just because they have
few distinct values. Repeated short labels and small integer code sets can still
be categorical, with separate limits by data type: `categoryLimit` for text (default 50,
also used for columns with value labels) and `numericCategoryLimit` for numbers (default 8).
The cases both limits are tested against live in `tests/fixtures/column-kind-cases.json`;
table-interface runs a copy of the same file. Empty and constant are observed properties independent of a declared
type. Heuristics cannot identify every numeric code without metadata.

Datetime inference accepts validated ISO dates/times, a space instead of T, and UTC
suffixes. Dates without times remain date. Dotted day-month-year dates remain
supported. Ambiguous slash dates require explicit format metadata; currently
%d/%m/%Y and %d/%m/%Y %H:%M:%S are supported. Timezone-free timestamps use UTC
consistently for analysis. Excel serials preserve wall-clock values under that policy;
their number format determines date versus datetime. Dates are numeric coordinates
with temporal chart axes, and can be sorted, filtered and used in structured maps.
