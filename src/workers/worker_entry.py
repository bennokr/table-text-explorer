"""The tasks the page can ask the Python worker for, each tied to the function that does it.

The page sends a task name and a JSON payload. Importing every task function here, explicitly,
is the only place that knows the whole list; the modules import just what they use.
"""

from analysis import run_projection
from cluster_names import name_clusters
from clustering import run_clustering
from column_screen import run_column_screen
from density import run_density_selection
from descriptions import describe_descriptions
from phrase_queries import match_phrases
from term_groups import describe_groups
from terms import build_term_index, describe_terms, index_tokens, matching_terms

TASKS = {
    "descriptions_describe": describe_descriptions,
    "phrase_matches": match_phrases,
    "terms_tokens": index_tokens,
    "cluster_names": name_clusters,
    "density_select": run_density_selection,
    "cluster": run_clustering,
    "terms_groups": describe_groups,
    "terms_build": build_term_index,
    "terms_describe": describe_terms,
    "terms_matches": matching_terms,
    "column_screen": run_column_screen,
}


def run(task, payload):
    """Run one task; anything that is not a named task is a projection request."""
    return TASKS.get(task, run_projection)(payload)
