# Optional codebooks and demo defaults

Variable semantics use [Frictionless Table Schema 2](https://datapackage.org/standard/table-schema/).
The `.metadata.json` suffix is a naming convention: these files are Table Schema,
not CSVW. Standard properties include fields, logical types, titles, descriptions,
categories, categoriesOrdered, missingValues, constraints and primaryKey.
Application extensions are explicit: `x-role` (identifier, code, text),
`x-measurement` (nominal, ordinal), `x-group`, `x-unit`, `x-concept_uri`,
`x-valueLabels` (a partial label dictionary), `x-source` and `x-reviewNotes`.
A label dictionary does not imply that other values are invalid. Closed category
lists use the standard categories property. Original cell values remain preserved.

## Spreadsheet profile v1

This is a documented application profile, not a standard XLSX serialization of
Frictionless. All sheets have a single header row, no merged cells or JSON cells.
Only Fields is required. Blank properties mean unspecified; field names match exactly.

| Sheet | Columns |
| --- | --- |
| Fields | name; optional title, description, type, format, measurement, role, group, unit, concept_uri, categoriesOrdered, minimum, maximum, pattern |
| Values | field, value; optional label, order, is_missing, closed |
| Missing | field (`*` for table defaults), value, optional label |
| Groups | id, title; optional parent, order |
| Dataset | key, value; primaryKey may have one row per key column |
| Review | note |

Use actual Excel booleans for categoriesOrdered, is_missing and closed. Order controls
category display, not the numeric magnitude of its code. `closed=false` creates
x-valueLabels rather than categories. Missing codes are strings, matched before
numeric conversion. Format codes as Text in Excel to preserve leading zeros.
Fields.type controls conversion of category codes; only integer/number/year codes
are converted to numbers. Use type=string for identifiers with leading zeros.
Source sheet/row columns in the RMC example are human review aids.

Convert an edited workbook without any network access:

```
node scripts/convert_codebook.mjs input-codebook.xlsx output.metadata.json
```

A small, invented example is available as [Table Schema JSON](examples/codebook/schema.metadata.json)
and an equivalent [spreadsheet](examples/codebook/codebook.xlsx). It includes an
identifier, category labels, a partial ordinal dictionary, numeric bounds, text,
boolean and datetime columns. The converter and ordinary tests need no private files.

Local RMC profiles may exist under `demo-config/RMC_synthetische_data_20_rijen.xlsx/`.
They and the original source workbook are ignored, not distributed. The local
`scripts/prepare_rmc_codebook.mjs` adapter additionally needs that directory's
review.json; source-owner review is necessary before using its inferred definitions.

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

Object/array-valued columns are omitted as a whole on import, reported by name in
ignoredFields and by count in the status bar. Remaining scalar values are untouched.
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
