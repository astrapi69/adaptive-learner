"""One term per concept in the help pages and the help glossary (#3433).

The catalog side lives in ``frontend/src/data/i18n/terms.test.ts``. Both
read ``frontend/src/data/i18n-terms.json``, so the decision is made once. This
check runs in verify_docs, which CI runs on every PR, so a help-only PR is
checked too; the Vitest step only runs when frontend files change.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs_help_terms import check_help_terms, rejected_terms  # noqa: E402

DE_RULES = [
    {
        "preferred": "Sitzung",
        "rejected": r"\bSessions?\b|Session-|-Session",
        "flags": "",
        "issue": "#3433",
    },
    {
        "preferred": "Serie",
        "rejected": r"\bStreaks?\b|Streak-|-Streak",
        "flags": "",
        "issue": "#3433",
    },
]


class _Report:
    def __init__(self) -> None:
        self.fails: list[str] = []
        self.notes: list[str] = []

    def fail(self, check: str, message: str, fixed: bool = False) -> None:
        self.fails.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


@pytest.mark.parametrize(
    ("text", "lines"),
    [
        ("Starte eine neue Session.", [1]),
        ("Dein Streak-Freeze hält.", [1]),
        ("Zeile eins\nLern-Session am Abend", [2]),
        ("Starte eine neue Sitzung.", []),
        ("Der Endpunkt `/api/sessions/{id}` und `LearningSession`.", []),
        ("```\nSession s = new Session();\n```\nDanach die Sitzung.", []),
        ("<!-- Session bleibt im Kommentar -->", []),
        ("Ein {streak}-Platzhalter", []),
    ],
    ids=[
        "rejected-word",
        "rejected-compound",
        "line-number",
        "preferred-term",
        "inline-code",
        "fenced-code",
        "html-comment",
        "placeholder",
    ],
)
def test_finds_rejected_terms_outside_code(text: str, lines: list[int]) -> None:
    assert [hit.line for hit in rejected_terms(text, DE_RULES)] == lines


def test_case_insensitive_rule_uses_its_flag() -> None:
    rules = [{"preferred": "session", "rejected": r"\bséances?\b", "flags": "i", "issue": "#3433"}]
    assert [hit.line for hit in rejected_terms("Une Séance courte", rules)] == [1]


def _repo(tmp_path: Path, table: dict | None = None) -> Path:
    data = tmp_path / "frontend" / "src" / "data"
    data.mkdir(parents=True)
    if table is not None:
        (data / "i18n-terms.json").write_text(json.dumps(table), encoding="utf-8")
    (tmp_path / "docs" / "help" / "de" / "user-guide").mkdir(parents=True)
    (tmp_path / "backend" / "config" / "help").mkdir(parents=True)
    return tmp_path


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_passes_a_clean_tree_and_reports_what_it_scanned(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {"de": DE_RULES})
    _write(repo / "docs/help/de/user-guide/session.md", "Eine Sitzung hat sieben Schritte.\n")
    _write(repo / "backend/config/help/concepts.de.yaml", "streak: Deine Serie\n")
    report = _Report()
    check_help_terms(report, repo)
    assert report.fails == []
    assert any("2 files" in note and "de 2" in note for note in report.notes)


def test_fails_on_a_rejected_term_with_file_and_line(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {"de": DE_RULES})
    _write(repo / "docs/help/de/user-guide/session.md", "Titel\n\nStarte die Session.\n")
    _write(repo / "backend/config/help/features.de.yaml", "x: Dein Streak\n")
    report = _Report()
    check_help_terms(report, repo)
    assert sorted(report.fails) == [
        'backend/config/help/features.de.yaml:1: "Streak" (use "Serie", #3433)',
        'docs/help/de/user-guide/session.md:3: "Session" (use "Sitzung", #3433)',
    ]


def test_leaves_out_developer_api_and_changelog_pages(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {"de": DE_RULES})
    _write(repo / "docs/help/de/user-guide/ok.md", "Sitzung\n")
    _write(repo / "docs/help/de/developer/plugins.md", "SQLAlchemy Session\n")
    _write(repo / "docs/help/de/api/endpoints.md", "Session-Endpunkte\n")
    _write(repo / "docs/help/de/changelog.md", "Neue Session-Ansicht\n")
    report = _Report()
    check_help_terms(report, repo)
    assert report.fails == []


def test_fails_closed_without_the_term_table(tmp_path: Path) -> None:
    repo = _repo(tmp_path, None)
    report = _Report()
    check_help_terms(report, repo)
    assert len(report.fails) == 1
    assert "i18n-terms.json" in report.fails[0]


def test_fails_closed_when_a_language_with_rules_has_no_help_files(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {"de": DE_RULES})
    report = _Report()
    check_help_terms(report, repo)
    assert len(report.fails) == 1
    assert "no help files" in report.fails[0]


def test_a_language_without_a_help_tree_is_noted_not_failed(tmp_path: Path) -> None:
    repo = _repo(tmp_path, {"de": DE_RULES, "ko": [{**DE_RULES[0], "rejected": "스트릭"}]})
    _write(repo / "docs/help/de/user-guide/ok.md", "Sitzung\n")
    report = _Report()
    check_help_terms(report, repo)
    assert report.fails == []
    assert any("ko" in note and "no help" in note for note in report.notes)
