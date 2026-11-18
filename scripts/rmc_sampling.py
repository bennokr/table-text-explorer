"""Seeded sampling for a fictional sparse RMC workload; no population estimates."""

import math


def comment_counts(size, histogram, ratio, rng):
    total = sum(histogram.values())
    expected = {int(count): frequency * size / total for count, frequency in histogram.items()}
    rounded = {count: math.floor(value) for count, value in expected.items()}
    remainder = size - sum(rounded.values())
    order = sorted(expected, key=lambda count: expected[count] - rounded[count], reverse=True)
    for count in order[:remainder]:
        rounded[count] += 1
    counts = [count for count, frequency in rounded.items() for _ in range(frequency)]
    rng.shuffle(counts)
    target = round(size * ratio[0] / ratio[1])
    while sum(counts) != target:
        step = 1 if sum(counts) < target else -1
        candidates = [i for i, count in enumerate(counts) if 0 <= count + step <= max(expected)]
        counts[rng.choice(candidates)] += step
    return counts


def jitter(row, fields, rng):
    for name, radius in (("Leeftijd", 3), ("AmduurBev", 1), ("Inclusie2", 1)):
        value = row[name]
        if value is None:
            continue
        bounds = fields[name]["constraints"]
        row[name] = max(
            bounds["minimum"], min(bounds["maximum"], value + rng.randint(-radius, radius))
        )


def birth_routing(row):
    previous = [
        "ErvEerst",
        "ErvTweed",
        "ErvDerde",
        "ErvVierd",
        "ErvVijfd",
        "ErvZesd",
        "ErvZevn",
        "ErvAcht",
        "ErvNegen",
    ]
    for ordinal, name in enumerate(previous, start=1):
        if ordinal >= (row.get("NrBev") or 1):
            row[name] = None
    if row.get("ModPart") != 1:
        row["ModPartVag"] = None
    if row.get("ModPart") == 1:
        row["ModPartKeiz"] = None
        row["PijnstKeizEpid"] = None
        row["PijnstKeizNarc"] = None
    if row.get("SeksuGew") != 1:
        row["SeksuGewGed"] = None


def is_text(field):
    """Free text: strings other than the identifier and postcode, which are generated apart."""
    return field["type"] == "string" and field["name"] not in ("ResPno", "Postcode")


def adverse_answer(parent, config):
    return 0 if parent in config["positive_questions"] else 1


def adverse(row, family, config):
    parent = family.get("parent_field")
    return parent is not None and row[parent] == adverse_answer(parent, config)


def structured_row(seed, profile, identity, context):
    fields, families, config, rng = (
        context[key] for key in ("fields", "families", "config", "rng")
    )
    row = {name: None if is_text(field) else seed.get(name) for name, field in fields.items()}
    row["ResPno"] = f"SYN-{identity:06d}"
    row["Postcode"] = f"0{rng.randrange(1000):03d}"
    jitter(row, fields, rng)
    birth_routing(row)
    row["ErvLtst"] = rng.choices([1, 2, 3, 4], profile["experience"])[0]
    for family in families:
        parent = family.get("parent_field")
        if parent is None:
            continue
        focus = parent.startswith(tuple(profile["focus"]))
        rate = profile["focus_rate"] if focus else profile["background_rate"]
        bad = rng.random() < rate
        answer = adverse_answer(parent, config)
        row[parent] = answer if bad else 1 - answer
        row[f"{parent}Last"] = int(rng.random() < 0.8) if bad else None
    for prefix in ("Dreig", "Discr"):
        row[f"{prefix}Algmn"] = int(
            any(
                adverse(row, family, config)
                for family in families
                if family.get("parent_field", "").startswith(prefix)
            )
        )
    return row


def family_weight(row, family, profile, config):
    name = family["fields"][0]
    if name == "ErvTkst" and (row.get("NrBev") or 1) < 2:
        return 0
    parent = family.get("parent_field")
    answers = config["response_answers"].get(name, [1] * len(family["responses"]))
    if parent is not None and row[parent] not in answers:
        return 0
    weight = config["field_weights"].get(name, 1)
    if name.startswith(tuple(profile["focus"])):
        weight *= 3
    if adverse(row, family, config):
        weight *= 2
    return weight


def choose_fields(rows, profiles, counts, context):
    families, config, rng = (context[key] for key in ("families", "config", "rng"))
    slots = []
    for row, profile, count in zip(rows, profiles, counts, strict=True):
        available = list(range(len(families)))
        chosen = []
        for _ in range(count):
            weights = [family_weight(row, families[index], profile, config) for index in available]
            index = rng.choices(available, weights)[0]
            chosen.append(index)
            available.remove(index)
        slots.append(chosen)
    return cover_fields(rows, slots, families, rng)


def cover_fields(rows, slots, families, rng):
    # Preserve each participant's text count while ensuring rare questions occur.
    counts = {index: sum(index in chosen for chosen in slots) for index in range(len(families))}
    for index, count in counts.items():
        if count:
            continue
        candidates = [
            i for i, chosen in enumerate(slots) if any(counts[item] > 1 for item in chosen)
        ]
        if families[index]["fields"] == ["ErvTkst"]:
            candidates = [i for i in candidates if (rows[i].get("NrBev") or 1) > 1]
        if not candidates:
            continue
        chosen = slots[rng.choice(candidates)]
        replaced = rng.choice([item for item in chosen if counts[item] > 1])
        chosen[chosen.index(replaced)] = index
        counts[replaced] -= 1
        counts[index] += 1
    return slots
