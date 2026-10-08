"""Tests for the per-locale help coverage ratchet in verify_docs (#3453).

Fifteen help pages existed only in EN/DE while the translated locales
served the German page instead, and no check compared the locale trees.
The ratchet holds each locale to its declared gaps: a new gap FAILs, a
closed gap still listed FAILs, and a missing basis never reads as clean.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs_locale_coverage import GAPS_FILE, check_locale_coverage  # noqa: E402


class _Report:
    def __init__(self) -> None:
        self.fails: list[str] = []
        self.notes: list[str] = []

    def fail(self, check: str, message: str, fixed: bool = False) -> None:
        self.fails.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


def _tree(root: Path, pages: dict[str, list[str]], gaps: dict[str, list[str]] | None) -> Path:
    for lang, slugs in pages.items():
        for slug in slugs:
            path = root / lang / f"{slug}.md"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("# x\n", encoding="utf-8")
    if gaps is not None:
        (root / GAPS_FILE).write_text(json.dumps({"gaps": gaps}), encoding="utf-8")
    return root


EN = ["index", "user-guide/navigation", "legal/privacy"]


def test_declared_gaps_pass_and_the_note_reports_the_measurement(tmp_path: Path) -> None:
    root = _tree(
        tmp_path,
        {"en": EN, "de": EN, "es": ["index"], "fr": EN},
        {"es": ["legal/privacy", "user-guide/navigation"]},
    )
    report = _Report()
    check_locale_coverage(report, root)
    assert report.fails == []
    assert report.notes == [
        "locale-coverage: 3 EN pages against 2 locales (es, fr); 2 missing page(s) in total"
    ]


def test_an_undeclared_gap_fails(tmp_path: Path) -> None:
    root = _tree(tmp_path, {"en": EN, "de": EN, "es": ["index"]}, {"es": ["legal/privacy"]})
    report = _Report()
    check_locale_coverage(report, root)
    assert len(report.fails) == 1 and "user-guide/navigation" in report.fails[0]


def test_a_closed_gap_that_is_still_listed_fails(tmp_path: Path) -> None:
    root = _tree(tmp_path, {"en": EN, "de": EN, "es": EN}, {"es": ["legal/privacy"]})
    report = _Report()
    check_locale_coverage(report, root)
    assert len(report.fails) == 1 and "now exist" in report.fails[0]


@pytest.mark.parametrize(
    ("pages", "gaps"),
    [
        ({"de": EN, "es": EN}, {}),
        ({"en": EN, "de": EN}, {}),
        ({"en": EN, "de": EN, "es": EN}, None),
    ],
    ids=["no-en-tree", "no-locale", "no-gaps-file"],
)
def test_a_missing_basis_fails_closed(
    tmp_path: Path, pages: dict[str, list[str]], gaps: dict[str, list[str]] | None
) -> None:
    report = _Report()
    check_locale_coverage(report, _tree(tmp_path, pages, gaps))
    assert len(report.fails) == 1 and "#2287" in report.fails[0]


def test_the_repo_matches_its_declared_gaps() -> None:
    report = _Report()
    check_locale_coverage(report, REPO / "docs" / "help")
    assert report.fails == []
