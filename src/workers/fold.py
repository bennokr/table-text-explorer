"""Folding words to a key, so inflected forms (boek, boeken) compare as one word.

The rules come from src/lexicon/<code>/fold.txt. The key is only used to merge near-duplicate
phrases and to keep cluster names from repeating a word; nothing that is shown, counted or
queried goes through it.
"""

LONG_VOWELS = "aeou"
CURLY_APOSTROPHE = "\N{RIGHT SINGLE QUOTATION MARK}"


def identity(word):
    return word


def apply_rules(word, rules):
    """The first rule whose suffix matches (leaving at least `minimum` letters) is applied once."""
    for suffix, replacement, minimum in rules:
        if word.endswith(suffix) and len(word) - len(suffix) >= minimum:
            return word[: len(word) - len(suffix)] + replacement
    return word


def collapse(word):
    """A long vowel before a last consonant becomes one letter: school -> schol, boot -> bot."""
    doubled = len(word) >= 4 and word[-2] == word[-3] and word[-2] in LONG_VOWELS
    return word[:-3] + word[-2:] if doubled and word[-1] not in "aeiou" else word


def undouble(word):
    """A doubled last consonant becomes one: mann -> man."""
    if len(word) >= 3 and word[-1] == word[-2] and word[-1] not in "aeiou":
        return word[:-1]
    return word


def drop_e(word):
    """A last e goes, so make, makes and making (-> mak) agree."""
    return word[:-1] if len(word) > 3 and word.endswith("e") else word


def compile_fold(spec):
    """A function from a word to its key, from a parsed fold.txt; no spec means no folding."""
    if not spec:
        return identity
    rules = [(suffix, replacement, int(number)) for suffix, replacement, number in spec["rules"]]
    named = (("collapse", collapse), ("undouble", undouble), ("dropE", drop_e))
    steps = [step for flag, step in named if spec.get(flag)]

    def fold(word):
        word = word.replace(CURLY_APOSTROPHE, "'")
        if not word.replace("'", "").isalpha():
            return word
        word = apply_rules(word, rules)
        for step in steps:
            word = step(word)
        return word

    return fold


def fold_phrase(phrase, fold):
    return " ".join(fold(word) for word in phrase.split())
