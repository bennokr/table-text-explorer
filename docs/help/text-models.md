# Text models

Choose a model for the text language and the kind of similarity you want to explore.

## Example

Use multilingual sentence embeddings for mixed Dutch/English text; compare Dutch MiniLM for Dutch-only data.

## Steps

1. Use TF-IDF for shared words and phrases, static vectors for pooled word meaning, or sentence embeddings for contextual meaning.
2. Select the language/model when applicable.
3. Start with complete text and the default chunking.

## Interpreting the result

Sentence embeddings represent meaning approximately. Dutch MiniLM is a community model with limited published evaluation; test representative real examples. Multilingual MiniLM supports more languages than Dutch and English. Models load only when requested, from local assets.

## Field descriptions

Include field descriptions to contextualize short or ambiguous text such as “not enough.”

The prefix uses the field description, then its label/title, then its column name. Short semantic descriptions are preferable to long repeated field descriptions. This option is independent of [field aggregation](combining.md), and only applies to sentence embeddings. An empty field still contributes no vector.

## Reusing embeddings

Encoding long text takes minutes (about 13 for 2,224 reviews). If you already have the vectors, choose **Sentence embeddings**, then **Import embeddings…** and pick the file. It is read on your machine and never uploaded. Two formats work: a NumPy `.npy` file (float16, float32 or float64, one row per record, in table order) or raw little-endian float32 (`.f32` or `.bin`), whose dimension is the file size divided by the record count. Vectors are scaled to unit length, and all-zero rows count as records without text. The map, clustering and Semantic splits then use them like the built-in model; chunking does not apply. A map's saved result offers **Download embeddings (.npy)** (under Exports) so the same vectors import again later.

## Long text

Long text values are split into chunks by default, so all text contributes.

First-chunk mode omits later text; coverage is saved with the result. Sentence tokenization preserves natural wording and stopwords. Static vectors use lexical tokens from [phrase settings](descriptions.md#phrase-counting), including all word lengths even when the phrase range excludes unigrams.

## Settings

Chunks hold 126 tokens with no overlap. These are fixed; the only choice is whether to use all chunks or the first one.

Static vectors support ordinary or TF-IDF-weighted word means. Their language models occupy separate spaces. Empty text and words absent from the model contribute no vector.

## Technical details

Both sentence models produce 384-dimensional field vectors before aggregation, using local CPU/WASM inference.

Chunks are weighted by newly covered text tokens. Description prefixes use at most 32 tokens and one third of the chunk budget; they do not inflate text-token coverage. Excessive overlap is rejected. Compatible field vectors are cached; changing weights, group assignments or aggregation can reuse them. Changing a description re-encodes affected fields when prefixes are enabled.
