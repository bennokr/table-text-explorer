# dbrd evaluation

2224 records. Gold manifest revision 1.

## Which columns does the text vary with?

**Text field `text`**

| column | class | skill beyond length | skill total | length alone explains | p vs nulls |
|---|---:|---:|---:|---:|---:|
| sentiment | strong | 0.444 | 0.446 | 0.00 | 0.042 |
| rating | strong | 0.254 | 0.259 | 0.01 | 0.042 |
| review_id | null | -0.021 | -0.027 | -0.01 | 0.708 |
| word_count | length | n/a | 0.998 | 1.00 (determined) | n/a |
| character_count | length | n/a | 0.909 | 0.91 (determined) | n/a |
| null controls (n=23) | null | -0.019 ± 0.005 (max -0.009) |  |  |  |

| grade | result |
|---|---:|
| strong columns beat every null | True |
| p = 0.05 resolvable with this many nulls | True |
| AUC strong vs null | 1.00 |
| AUC strong+moderate vs null | 1.00 |
| length columns detected beyond length | none |
| columns determined by length (not scored) | ['word_count', 'character_count'] |
