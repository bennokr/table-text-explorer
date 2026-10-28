"""Compose compatible fictional responses without an LLM or record-ID suffixes."""

import re


def extend_families(families, config, additions):
    by_field = {family["fields"][0]: family for family in families}
    used = {response["text"] for family in families for response in family["responses"]}
    for addition in additions["responses"]:
        name, text = addition["field"], addition["text"].strip()
        if name not in by_field or addition["parent_answer"] not in {0, 1}:
            raise ValueError("Invalid field or answer in synthetic text additions.")
        if not text or text in used:
            raise ValueError("Empty or duplicate synthetic text addition.")
        family = by_field[name]
        answers = config["response_answers"].setdefault(name, [1] * len(family["responses"]))
        family["responses"].append({"text": text})
        answers.append(addition["parent_answer"])
        used.add(text)


def clean_text(text):
    # Remove mechanical padding left in the original small-model seed bank.
    return re.sub(r" Dat bleef me bij(?: en dat vond ik lastig)*\.$", "", text).strip()


def response_pool(row, family, config, rng):
    name = family["fields"][0]
    parent = family.get("parent_field")
    if parent is not None:
        answers = config["response_answers"].get(name, [1] * len(family["responses"]))
        pool = [i for i, answer in enumerate(answers) if answer == row[parent]]
        if name == "DiscrLeeftToel" and (row.get("Leeftijd") or 30) > 30:
            pool = [i for i in pool if i not in {0, 2, 4}]
        return pool
    if name == "ToelVrgl":
        tone = {1: "positive", 2: "positive", 3: "mixed", 4: "negative"}[row["ErvLtst"]]
        group = rng.choices([tone, "neutral"], [0.8, 0.2])[0]
        return config["general_pools"][group]
    return [i for i in range(len(family["responses"])) if i != 9]


def candidate_text(row, family, config, verbosity, rng):
    pool = response_pool(row, family, config, rng)
    if not pool:
        raise ValueError(f"No compatible synthetic response for {family['id']}")
    parts = rng.choices([1, 2, 3], [0.6, 0.3, 0.1])[0]
    parts = min(len(pool), max(parts, verbosity))
    indices = rng.sample(pool, parts)
    if family["fields"] == ["ToelVrgl"] and any(i in config["standalone_general"] for i in indices):
        indices = [next(i for i in indices if i in config["standalone_general"])]
    return " ".join(clean_text(family["responses"][i]["text"]) for i in indices), indices


def fill_text(row, family, config, used, rng):
    parent = family.get("parent_field")
    name = family["fields"][0]
    if parent is not None:
        answers = config["response_answers"].get(name, [1] * len(family["responses"]))
        if row[parent] not in answers:
            row[parent] = answers[0]
            row[f"{parent}Last"] = 1
    for attempt in range(48):
        # Prefer fresh compositions, but disclose exhausted pools rather than add
        # meaningless IDs/padding to make a duplicate look like unique language.
        text, indices = candidate_text(row, family, config, min(3, 1 + attempt // 16), rng)
        if text not in used:
            break
    row[name] = text
    used.add(text)
    return {"field": name, "family": family["id"], "responses": indices}


def fill_participant(row, selected, context, used):
    families, config, rng = (context[key] for key in ("families", "config", "rng"))
    lineage = [fill_text(row, families[index], config, used, rng) for index in selected]
    for prefix in ("Dreig", "Discr"):
        parents = [
            family["parent_field"]
            for family in families
            if family.get("parent_field", "").startswith(prefix)
        ]
        row[f"{prefix}Algmn"] = int(any(row[parent] == 1 for parent in parents))
    return lineage
