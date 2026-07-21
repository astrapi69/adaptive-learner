#!/usr/bin/env python3
"""Script-sanity lint for the i18n catalogs (#1755). Stdlib only.

Origin: #1753 shipped the whole #1743 i18n surface ASCII-degraded in 7 of
11 catalogs and was only caught by a user screenshot. Two of the defect
classes are deterministic enough to gate:

* **Stage 1 - de substitute spelling.** ae/oe/ue/ss replacement forms of
  known German words ("Fuege ... Uebungen") violate the standing
  real-umlauts rule. A curated wordlist keeps legitimate ae/oe/ue
  sequences (Quelle, Dauer, aktuell, Bauer) from ever firing.
* **Stage 2 - el/hi script mismatch.** A value whose letters are mostly
  LATIN inside the Greek-script or Devanagari catalog is a latin
  transliteration ("Epikolliste mono keimena ...") - functionally a
  missing translation, the severest #1753 class. Placeholders and
  technical/product tokens are stripped before counting.

NOT covered (by design): missing accents in otherwise-correct-script
es/fr/pt/tr values - not machine-detectable without a dictionary; the
LLM quality pass (``make i18n-quality-check``, #1296) remains the tool
for that.

The gate is HARD (exit 1 on any finding): the catalogs are clean as of
#1754, so no baseline/ratchet is needed.

Usage::

    python3 scripts/verify_i18n_scripts.py            # lint de + el + hi
    python3 scripts/verify_i18n_scripts.py --lang de   # one catalog

Wired as the ``i18n-script-sanity`` pre-commit hook (scoped to
``backend/config/i18n/*.yaml``) and ``make verify-i18n-scripts``.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))

from export_i18n_review import I18N_DIR, flatten, load_catalog  # noqa: E402

# --- Stage 1: German substitute spelling -----------------------------------

# Curated replacement FORMS (lowercase). Whole-word, case-insensitive.
# Each entry is an ae/oe/ue/ss spelling of a real German word; ordinary
# words that merely contain the digraphs (Quelle, Dauer, aktuell, Bauer,
# Feuer, neue, blaue) are NOT listed, so they can never fire. Extend the
# list when a new degraded form slips through - never loosen it into a
# bare digraph scan (false-positive machine).
DE_SUBSTITUTE_WORDS = (
    # #1753 originals
    "fuege",
    "fuegst",
    "fuegen",
    "einfuegen",
    "hinzufuegen",
    "fuer",
    "persoenlich",
    "persoenlichen",
    "persoenliche",
    "uebung",
    "uebungen",
    "durchlaeufst",
    "durchlaeuft",
    # common UI vocabulary
    "ueber",
    "uebersicht",
    "uebersetzung",
    "uebersetzungen",
    "uebernehmen",
    "ueberpruefen",
    "uebersprungen",
    "ueberspringen",
    "zurueck",
    "druecken",
    "druecke",
    "pruefen",
    "pruefe",
    "pruefung",
    "pruefst",
    "geprueft",
    "gepruefte",
    "uebertragen",
    "spaetere",
    "spaeteren",
    "schluessel",
    "loeschen",
    "loesche",
    "loesung",
    "loesungen",
    "koennen",
    "koennte",
    "koenntest",
    "moechte",
    "moechtest",
    "moeglich",
    "waehle",
    "waehlen",
    "waehrend",
    "erklaerung",
    "erklaerungen",
    "naechste",
    "naechsten",
    "naechster",
    "spaeter",
    "taeglich",
    "taegliche",
    "regelmaessig",
    "gemaess",
    "groesse",
    "groesser",
    "schliessen",
    "schliesse",
    "abschliessen",
    "strasse",
    "muessen",
    "laesst",
    "verfuegbar",
    "ungueltig",
    "gueltig",
    "aendern",
    "aenderungen",
    "bestaetigen",
    "bestaetige",
    "ausfuehren",
    "zufaellig",
    "hoeren",
    "woerter",
    "saetze",
    "gruen",
    "waere",
    "haette",
    "staerken",
    "schwaechen",
    "faehigkeiten",
    "aktivitaet",
    "aktivitaeten",
    "qualitaet",
    "erhoehen",
    "erhoeht",
    "gehoert",
    "benoetigt",
    "benoetigen",
    "unterstuetzt",
    "unterstuetzen",
    "vollstaendig",
    "selbststaendig",
    # NOTE: "musst"/"muesste"-style entries need care - "musst" IS correct
    # post-reform German (du musst) and must never be listed.
)

_DE_PATTERN = re.compile(
    r"\b(" + "|".join(DE_SUBSTITUTE_WORDS) + r")\b",
    re.IGNORECASE,
)

# --- Stage 2: script mismatch ----------------------------------------------

# Tokens that legitimately stay latin inside ANY catalog: product and
# format names, technical abbreviations. Compared case-insensitively as
# whole tokens after placeholder stripping.
LATIN_ALLOWED_TOKENS = frozenset(
    token.lower()
    for token in (
        "AI",
        "KI",
        "API",
        "URL",
        "ISBN",
        "ASIN",
        "QR",
        "XP",
        "OK",
        "PDF",
        "ZIP",
        "JSON",
        "YAML",
        "CSV",
        "TSV",
        "HTML",
        "PWA",
        "LAN",
        "ID",
        "App",
        "Web",
        "E-Mail",
        "Email",
        "Token",
        "Cloze",
        "Anki",
        "NotebookLM",
        "GitHub",
        "Claude",
        "Anthropic",
        "OpenAI",
        "Gemini",
        "Google",
        "Docker",
        "Markdown",
        "Level",
        "CEFR",
        "A1",
        "A2",
        "B1",
        "B2",
        "C1",
        "C2",
        "TTS",
        "SRS",
        "et",
        "p",
        "ch",
        # Brand / dev-facing proper nouns that legitimately stay latin.
        "Adaptive",
        "Learner",
        "AdaptiveLearner",
        "Podcast",
        "Framework",
        "Frameworks",
        "Build",
        "Commit",
        "Issues",
        "Repository",
        "Browser",
    )
)

# Whole KEYS whose values are structurally latin by design: theme names,
# the literal RESET confirmation word, the social-share hashtag. Matched
# as regexes against the flattened dot-key.
KEY_ALLOWLIST_PATTERNS = tuple(
    re.compile(pattern)
    for pattern in (
        r"^ui\.themes\.",
        r"\.danger_zone_input_placeholder$",
        r"^share\.achievement\.hashtag$",
        # A relative asset FILE PATH example (#1895): identical in every
        # language, like the en value ("assets/audio/clip.mp3").
        r"\.dict_audio_placeholder$",
    )
)

_PLACEHOLDER = re.compile(r"\{[^}]*\}")
_WORD = re.compile(r"[^\W\d_]+", re.UNICODE)

# Minimum native-relevant letters a value must have before the ratio is
# judged: shorter remainders ("Beta", "Pro") are noise, not translations.
MIN_LETTERS = 4
LATIN_RATIO_LIMIT = 0.8

EXPECTED_SCRIPT = {"el": "GREEK", "hi": "DEVANAGARI"}


@dataclass
class Finding:
    """One flagged catalog value."""

    lang: str
    key: str
    reason: str
    words: list[str] = field(default_factory=list)


def _letter_script(char: str) -> str:
    """Return the Unicode script bucket of a letter: LATIN / GREEK /
    DEVANAGARI / OTHER, via the character's Unicode name (stdlib-only;
    good enough for a lint, no ``regex`` dependency)."""
    name = unicodedata.name(char, "")
    for script in ("LATIN", "GREEK", "DEVANAGARI"):
        if name.startswith(script):
            return script
    return "OTHER"


def find_de_substitutions(flat: dict[str, object]) -> list[Finding]:
    """Stage 1: flag German values containing curated substitute-spelling
    forms (ae/oe/ue/ss replacements of real words)."""
    findings: list[Finding] = []
    for key, value in sorted(flat.items()):
        if not isinstance(value, str):
            continue
        hits = sorted({m.group(0).lower() for m in _DE_PATTERN.finditer(value)})
        if hits:
            findings.append(
                Finding(
                    lang="de",
                    key=key,
                    reason="substitute spelling (use real umlauts)",
                    words=hits,
                )
            )
    return findings


def find_script_mismatches(flat: dict[str, object], lang: str) -> list[Finding]:
    """Stage 2: flag values whose letters are mostly latin in a catalog
    whose language uses a non-latin script (el -> Greek, hi -> Devanagari)."""
    expected = EXPECTED_SCRIPT[lang]
    findings: list[Finding] = []
    for key, value in sorted(flat.items()):
        if not isinstance(value, str):
            continue
        if any(pattern.search(key) for pattern in KEY_ALLOWLIST_PATTERNS):
            continue
        stripped = _PLACEHOLDER.sub(" ", value)
        counted_words: list[str] = []
        latin = native = 0
        for word in _WORD.findall(stripped):
            if word.lower() in LATIN_ALLOWED_TOKENS:
                continue
            counted_words.append(word)
            for char in word:
                script = _letter_script(char)
                if script == "LATIN":
                    latin += 1
                elif script == expected:
                    native += 1
        total = latin + native
        if total < MIN_LETTERS:
            continue
        if latin / total > LATIN_RATIO_LIMIT:
            findings.append(
                Finding(
                    lang=lang,
                    key=key,
                    reason=(
                        f"latin transliteration suspected "
                        f"({latin}/{total} letters latin, expected {expected})"
                    ),
                    words=counted_words[:6],
                )
            )
    return findings


def lint_catalog(lang: str) -> list[Finding]:
    """Run the stage matching ``lang`` against its shipped catalog."""
    flat = flatten(load_catalog(I18N_DIR / f"{lang}.yaml"))
    if lang == "de":
        return find_de_substitutions(flat)
    if lang in EXPECTED_SCRIPT:
        return find_script_mismatches(flat, lang)
    raise SystemExit(f"unsupported --lang {lang} (supported: de, el, hi)")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--lang",
        choices=("de", "el", "hi"),
        action="append",
        help="lint only this catalog (repeatable; default: de + el + hi)",
    )
    args = parser.parse_args(argv)
    langs = args.lang or ["de", "el", "hi"]

    all_findings: list[Finding] = []
    for lang in langs:
        findings = lint_catalog(lang)
        all_findings.extend(findings)
        status = "FAIL" if findings else "OK"
        print(f"{status:4} {lang}.yaml ({len(findings)} finding(s))")
        for finding in findings:
            detail = f" [{', '.join(finding.words)}]" if finding.words else ""
            print(f"     {finding.key}: {finding.reason}{detail}", file=sys.stderr)

    if all_findings:
        print(
            "\ni18n script-sanity lint failed. Restore native script / real "
            "umlauts in the values above (see #1753 / #1755).",
            file=sys.stderr,
        )
        return 1
    print("\ni18n script-sanity lint clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
