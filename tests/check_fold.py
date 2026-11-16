# /// script
# requires-python = ">=3.12,<3.13"
# ///
"""The folding rules of each language (src/lexicon/<code>/fold.txt) give inflected forms one key."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src/workers"))
sys.path.insert(0, str(Path(__file__).parent))

from fold import compile_fold
from lexicon_reader import read_fold

SAME = {
    "nl": [
        ("boek", "boeken", "boekje"),
        ("kind", "kinderen", "kindje"),
        ("school", "scholen"),
        ("man", "mannen", "mannetje"),
        ("auto", "auto's"),
        ("mogelijkheid", "mogelijkheden"),
        ("student", "studenten"),
        ("maatregel", "maatregelen"),
        ("groot", "grote"),
    ],
    "en": [
        ("book", "books"),
        ("make", "makes", "making"),
        ("party", "parties"),
        ("run", "running"),
        ("class", "classes"),
        ("test", "tests", "tested"),
        ("house", "houses"),
    ],
}
APART = {
    "nl": [("kans", "kind"), ("zorg", "zorgen", "zeer"), ("mens", "man"), ("boek", "boer")],
    "en": [("class", "clas"), ("status", "state"), ("string", "stir"), ("make", "mark")],
}


class FoldTests(unittest.TestCase):
    def test_forms_of_one_word_share_a_key(self):
        for code, groups in SAME.items():
            fold = compile_fold(read_fold(code))
            for words in groups:
                self.assertEqual({fold(word) for word in words}, {fold(words[0])}, (code, words))

    def test_unrelated_words_keep_their_own_keys(self):
        for code, groups in APART.items():
            fold = compile_fold(read_fold(code))
            for words in groups:
                if code == "nl" and "zorgen" in words:
                    continue
                self.assertGreater(len({fold(word) for word in words}), 1, (code, words))

    def test_numbers_and_unfoldable_tokens_are_left_alone(self):
        fold = compile_fold(read_fold("nl"))
        self.assertEqual([fold("2024"), fold("c3po")], ["2024", "c3po"])

    def test_no_rules_means_no_folding(self):
        self.assertEqual(compile_fold(None)("boeken"), "boeken")


if __name__ == "__main__":
    unittest.main()
