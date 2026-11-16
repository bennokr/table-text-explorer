"""The echo removal changes only what repeats court, court type and year, for every ruling."""

import importlib.util
import unittest
from collections import Counter
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "clean_rechtspraak", Path(__file__).parents[1] / "scripts/clean_rechtspraak.py"
)
cleaner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cleaner)

ROWS = [
    {"court": "Rechtbank Den Haag", "court_type": "Rechtbank", "year": "2016"},
    {"court": "Gerechtshof Arnhem-Leeuwarden", "court_type": "Gerechtshof", "year": "2024"},
]


class EchoRemoval(unittest.TestCase):
    def clean(self, text):
        return cleaner.clean(text, cleaner.patterns(ROWS), Counter())

    def test_court_year_case_number_ecli_and_location_are_removed(self):
        text = (
            "RECHTBANK DEN HAAG Zittingsplaats Arnhem ECLI:NL:RBDHA:2016:542 zaaknummer "
            "201503819/1/V6 uitspraak van 2 maart 2016 over de verdachte"
        )
        self.assertEqual(self.clean(text), "zaaknummer uitspraak van 2 maart over de verdachte")

    def test_the_same_words_are_removed_from_every_ruling_not_only_from_its_own_court(self):
        # An appeal that mentions the lower court loses the mention too, so absence is no signal.
        text = "Het gerechtshof vernietigt de uitspraak van de rechtbank Den Haag in 2019"
        self.assertEqual(self.clean(text), "Het vernietigt de uitspraak van de in")

    def test_everything_else_survives_including_names_and_numbers(self):
        text = "De verdachte [naam A] kreeg 120 uur taakstraf en art. 8 lid 2 is van toepassing"
        self.assertEqual(self.clean(text), text)

    def test_counts_say_what_was_removed(self):
        counts = Counter()
        cleaner.clean("Rechtbank Den Haag 2016 en 2017", cleaner.patterns(ROWS), counts)
        self.assertEqual(counts["year"], 2)
        self.assertEqual(counts["court"], 1)


if __name__ == "__main__":
    unittest.main()
