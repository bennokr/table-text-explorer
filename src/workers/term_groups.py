"""Describe stable cluster memberships through the existing all-record text index."""

import json

from terms import describe_terms


def describe_groups(payload, describe=None):
    describe = describe or describe_terms
    groups = json.loads(payload)
    result = []
    for group in groups["groups"]:
        request = {**groups, "subset": group["subset"], "comparison": group["comparison"]}
        description = json.loads(describe(json.dumps(request)))
        result.append({**group, "description": description})
    return json.dumps({"groups": result}, allow_nan=False)
