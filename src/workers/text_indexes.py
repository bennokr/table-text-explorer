"""Shared sparse fields with bounded, addressable index variants."""

index_registry = {}
field_indexes = {}
token_indexes = {}
current_revision = None


def get_text_index(identity):
    if identity not in index_registry:
        raise ValueError("Build the n-gram index again.")
    return index_registry[identity]


def tokenize_column(column, data, tokenizer):
    key = (data["_namespace"], column["name"])
    if key not in token_indexes:
        token_indexes[key] = [tokenizer(value) for value in column["texts"]]
    return token_indexes[key]


def reset_revision(data):
    global current_revision
    if "revision" not in data or data["revision"] == current_revision:
        return
    index_registry.clear()
    field_indexes.clear()
    token_indexes.clear()
    current_revision = data["revision"]


def register_text_index(data, builder, progress=None):
    reset_revision(data)
    namespace = data.get("revision", data.get("cacheKey", object()))
    data["_namespace"] = namespace
    fields = {}
    keys = set()
    reused = True
    for position, column in enumerate(data["columns"]):
        key = (
            namespace,
            column["name"],
            tuple(data["sizes"]),
            tuple(sorted(set(data["stopwords"]))),
        )
        if key not in field_indexes:
            if progress is not None:
                progress(f"Indexing {column['name']}", position, len(data["columns"]))
            field_indexes[key] = builder(column, data)
            reused = False
        fields[column["name"]] = field_indexes[key]
        keys.add(key)
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
