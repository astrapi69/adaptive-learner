"""Tests for scripts/verify_i18n_scripts.py (#1755).

The script-sanity lint has two deterministic stages:

* Stage 1 (de): flag ae/oe/ue/ss SUBSTITUTE spelling of known German
  words (the #1753 "Fuege ... Uebungen" class). Curated wordlist, so
  legitimate ae/oe/ue sequences (Quelle, Dauer, aktuell) never fire.
* Stage 2 (el/hi): flag values whose letters are mostly LATIN in a
  Greek-script / Devanagari catalog (the #1753 transliteration class:
  "Epikolliste mono keimena ..."). Product names and technical tokens
  (URL, ISBN, Anki, ...) are stripped before counting.

Pure helpers are tested here without touching the real catalogs; the
end-to-end run against the shipped catalogs is pinned as clean.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SCRIPTS = REPO / "scripts"
sys.path.insert(0, str(SCRIPTS))

from verify_i18n_scripts import (  # noqa: E402
    find_de_substitutions,
    find_script_mismatches,
)


class TestStage1DeSubstitutions:
    def test_flags_the_1753_class(self) -> None:
        flat = {
            "a.rights": "Fuege nur Texte ein, die fuer den persoenlichen Gebrauch sind.",
            "a.gen": "Theorie + Uebungen generieren",
        }
        findings = find_de_substitutions(flat)
        assert {f.key for f in findings} == {"a.rights", "a.gen"}
        words = {w for f in findings for w in f.words}
        assert "fuege" in words
        assert "uebungen" in words

    def test_clean_german_passes(self) -> None:
        flat = {
            "a.rights": "Füge nur Texte ein, die für den persönlichen Gebrauch sind.",
            "a.gen": "Theorie + Übungen generieren",
        }
        assert find_de_substitutions(flat) == []

    def test_flags_oeffnen_the_2315_leak(self) -> None:
        """Die Form, die live im Katalog stand: help.open_help war
        "Hilfe oeffnen", und der Waechter meldete de.yaml sauber. Eine
        kuratierte Liste waechst aus Evidenz - das hier ist die Evidenz."""
        flat = {"ui.help.open_help": "Hilfe oeffnen"}
        findings = find_de_substitutions(flat)
        assert {f.key for f in findings} == {"ui.help.open_help"}
        assert "oeffnen" in {w for f in findings for w in f.words}

    def test_legitimate_ae_oe_ue_sequences_do_not_fire(self) -> None:
        # ue/ae/oe inside ordinary German words is NOT substitute spelling.
        flat = {
            "a.q": "Quelle und Dauer der aktuellen Sitzung",
            "a.b": "Bauer, Feuer, neue Themen, blaue Karten",
            "a.c": "Israel und Michael lesen Poesie",
        }
        assert find_de_substitutions(flat) == []

    def test_word_boundary_and_case(self) -> None:
        # Capitalised + inflected forms from the curated list fire; the
        # match is whole-word (no partial hits inside longer words).
        flat = {"a.x": "Ueber die Grenze", "a.y": "Zurueck zur Uebersicht"}
        findings = find_de_substitutions(flat)
        assert {f.key for f in findings} == {"a.x", "a.y"}


class TestStage2ScriptMismatch:
    def test_flags_latin_transliteration_in_el(self) -> None:
        flat = {
            "b.hint": "Epikolliste mono keimena gia ta opoia echete dikaiomata.",
        }
        findings = find_script_mismatches(flat, "el")
        assert [f.key for f in findings] == ["b.hint"]

    def test_flags_latin_transliteration_in_hi(self) -> None:
        flat = {
            "b.hint": "Keval wahi text paste karen jinke rights aapke paas hain.",
        }
        findings = find_script_mismatches(flat, "hi")
        assert [f.key for f in findings] == ["b.hint"]

    def test_native_script_passes(self) -> None:
        el = {"b.hint": "Επικολλήστε μόνο κείμενα για τα οποία έχετε δικαιώματα."}
        hi = {"b.hint": "केवल वही टेक्स्ट पेस्ट करें जिनके अधिकार आपके पास हैं।"}
        assert find_script_mismatches(el, "el") == []
        assert find_script_mismatches(hi, "hi") == []

    def test_technical_tokens_and_placeholders_are_ignored(self) -> None:
        flat = {
            "b.url": "URL",
            "b.asin": "ISBN / ASIN",
            "b.anki": "Anki",
            "b.count": "{n} XP",
            "b.mixed": "Το AI γράφει τη θεωρία με δικά του λόγια.",
        }
        assert find_script_mismatches(flat, "el") == []

    def test_mostly_native_with_a_latin_word_passes(self) -> None:
        # A native sentence naming a latin product/term stays clean.
        flat = {"b.x": "Δημιουργήστε μια Cloze άσκηση με το AI."}
        assert find_script_mismatches(flat, "el") == []


class TestEndToEnd:
    def test_shipped_catalogs_are_clean(self) -> None:
        """The hard gate holds on the real catalogs (post-#1754 state)."""
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "verify_i18n_scripts.py")],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr


class TestStage1HelpGlossary:
    """#3413: the German help glossary (backend/config/help/*.de.yaml)
    shipped in ASCII transliteration because Stage 1 only read de.yaml."""

    @staticmethod
    def _run(help_dir: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable,
                str(SCRIPTS / "verify_i18n_scripts.py"),
                "--lang",
                "de",
                "--help-dir",
                str(help_dir),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_detects_substitute_word_in_help_file(self, tmp_path: Path) -> None:
        (tmp_path / "steps.de.yaml").write_text(
            "category: steps\nlanguage: de\nentries:\n"
            "  - key: practice\n"
            '    short: "Du uebst, bis es sitzt."\n'
            "    long: |\n      Die AI schlaegt faellige Verlaeufe vor.\n",
            encoding="utf-8",
        )
        result = self._run(tmp_path)
        assert result.returncode == 1, result.stdout + result.stderr
        assert "FAIL help/steps.de.yaml" in result.stdout
        for word in ("uebst", "schlaegt", "faellige", "verlaeufe"):
            assert word in result.stderr

    def test_clean_help_file_passes_and_is_reported(self, tmp_path: Path) -> None:
        (tmp_path / "steps.de.yaml").write_text(
            "entries:\n  - key: practice\n"
            '    short: "Du übst, bis es sitzt. Quelle, neue Themen, dass."\n',
            encoding="utf-8",
        )
        (tmp_path / "steps.en.yaml").write_text(
            'entries:\n  - short: "fuer is ignored outside de"\n', encoding="utf-8"
        )
        result = self._run(tmp_path)
        assert result.returncode == 0, result.stdout + result.stderr
        assert "OK   help/steps.de.yaml (0 finding(s))" in result.stdout
        assert "steps.en.yaml" not in result.stdout
        assert "1 help file(s) scanned" in result.stdout

    def test_fails_closed_when_no_help_files_found(self, tmp_path: Path) -> None:
        result = self._run(tmp_path)
        assert result.returncode != 0
        assert "no German help files" in result.stderr

    def test_shipped_help_glossary_is_scanned(self) -> None:
        result = subprocess.run(
            [sys.executable, str(SCRIPTS / "verify_i18n_scripts.py"), "--lang", "de"],
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        for name in ("concepts", "features", "methods", "steps"):
            assert f"OK   help/{name}.de.yaml" in result.stdout
