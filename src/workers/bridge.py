"""The two things the page hands to the Python workers: saved embeddings and a progress callback.

Everything else a worker module needs, it imports. The page sets these before each request and the
modules read them when they run, so tests can set them directly.
"""

embedding_values = None  # Saved embeddings (a flat array of floats) for the request, or None.
progress_callback = None  # Called as (message, completed, total); None when nobody listens.


def values():
    """The embeddings as a plain list, whether they came from the page (a JS proxy) or a test."""
    if embedding_values is None:
        return None
    return embedding_values.to_py() if hasattr(embedding_values, "to_py") else embedding_values
