"""Shared sparse fields with bounded, addressable index variants."""

index_registry = {}
field_indexes = {}
token_indexes = {}
current_revision = None
STEP_ROWS = 1000  # Rows between progress reports; keeps the callback cost negligible.


def get_text_index(identity):
    if identity not in index_registry:
        raise ValueError("Build the n-gram index again.")
    return index_registry[identity]


def ignore_step(rows):
    """Progress sink for native callers and tests, which report nothing."""


def column_stepper(progress, label, done_before, total):
    """Return step(rows): report overall row-steps every STEP_ROWS rows.

    Indexing one column is two passes over its rows (tokenize, then count n-grams),
    so a build over N pending columns has 2 * N * rows steps in total.
    """
    state = {"done": done_before, "unreported": 0}

    def step(rows):
        state["done"] += rows
        state["unreported"] += rows
        if state["unreported"] >= STEP_ROWS:
            state["unreported"] = 0
            progress(label, state["done"], total)

    return step


def tokenize_column(column, data, tokenizer):
    key = (data["_namespace"], column["name"])
    step = data.get("_step", ignore_step)
    if key in token_indexes:
        step(len(column["texts"]))
        return token_indexes[key]
    tokens = []
    for start in range(0, len(column["texts"]), STEP_ROWS):
        chunk = column["texts"][start : start + STEP_ROWS]
        tokens.extend(tokenizer(value) for value in chunk)
        step(len(chunk))
    token_indexes[key] = tokens
    return tokens


def reset_revision(data):
    global current_revision
    if "revision" not in data or data["revision"] == current_revision:
        return
    index_registry.clear()
    field_indexes.clear()
    token_indexes.clear()
    current_revision = data["revision"]


def field_key(namespace, column, data):
    return (
        namespace,
        column["name"],
        tuple(data["sizes"]),
        tuple(sorted(set(data["stopwords"]))),
    )


def build_fields(data, builder, progress, namespace):
    """Build or reuse one index per column, reporting row-level progress."""
    keys = [field_key(namespace, column, data) for column in data["columns"]]
    pending = [key for key in keys if key not in field_indexes]
    rows_per_column = 2 * data["rows"]
    total = len(pending) * rows_per_column
    done = 0
    for column, key in zip(data["columns"], keys, strict=True):
        if key in field_indexes:
            continue
        label = f"Indexing {column['name']}"
        if progress is not None:
            data["_step"] = column_stepper(progress, label, done, total)
        field_indexes[key] = builder(column, data)
        done += rows_per_column
        if progress is not None:
            progress(label, done, total)
    data.pop("_step", None)
    names = [column["name"] for column in data["columns"]]
    fields = {name: field_indexes[key] for name, key in zip(names, keys, strict=True)}
    return fields, set(keys), not pending


def register_text_index(data, builder, progress=None):
    reset_revision(data)
    namespace = data.get("revision", data.get("cacheKey", object()))
    data["_namespace"] = namespace
    fields, keys, reused = build_fields(data, builder, progress, namespace)
    documents = {
        name: token_indexes.get((namespace, name), [[] for _ in range(data["rows"])])
        for name in fields
    }
    entry = {
        "documents": documents,
        "stopwords": set(data["stopwords"]),
        "fields": fields,
        "rows": data["rows"],
        "keys": keys,
        "reused": reused,
    }
    index_registry[data["indexId"]] = entry
    trim_indexes(data.get("protectedIndexId"), data["indexId"])
    return entry


def trim_indexes(protected, latest):
    for identity in list(index_registry):
        if len(index_registry) <= 4:
            break
        if identity not in {protected, latest}:
            del index_registry[identity]
    referenced = set().union(*(entry["keys"] for entry in index_registry.values()))
    for key in list(field_indexes):
        if key not in referenced:
            del field_indexes[key]

    token_keys = {key[:2] for key in referenced}
    for key in list(token_indexes):
        if key not in token_keys:
            del token_indexes[key]
