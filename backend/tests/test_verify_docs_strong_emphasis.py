"""Bold that renders as literal asterisks in the in-app help (#3655).

The in-app help renders Markdown with react-markdown (CommonMark + GFM).
Whether ``**`` opens or closes depends on the flanking rule, the characters
directly around it, so ``カード**「ラベル」**は`` shows its asterisks while
``「**ラベル**」`` is bold. The gate checks that rule for every help page;
measured against the real parser on all help pages it reported the same runs,
none extra and none missing.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs_strong_emphasis import (  # noqa: E402
    check_strong_emphasis,
    literal_strong_lines,
)


@pytest.mark.parametrize(
    ("text", "lines"),
    [
        ("カード**「テキストからの知識レッスン」**は、", [1, 1]),
        ("演習の**「AIに質問」**。", [1, 1]),
        ("常に**`develop`**を対象に", [1, 1]),
        ("サーバーは**http://localhost:15174**で、", [1, 1]),
        ("- **FastAPI（Python 3.12イメージ）**がビルド", [1, 1]),
        ("Text **como booleanos\n+ enums de fonte** (o backend", [1, 2]),
        ("ορατή **μόνο σε API· χωρίς", [1]),
    ],
    ids=[
        "ja-label",
        "ja-label-period",
        "ja-code",
        "ja-autolink",
        "ja-paren",
        "pt-list",
        "el-unclosed",
    ],
)
def test_flags_bold_that_renders_literally(text: str, lines: list[int]) -> None:
    assert literal_strong_lines(text) == lines


@pytest.mark.parametrize(
    "text",
    [
        "カード「**テキストからの知識レッスン**」は、",
        "- **「duplicate column name」でテストが失敗する**: Alembic",
        "常に **`develop`** を対象に",
        "サーバーは **http://localhost:15174** で、",
        "- **`.alb` ZIP backup format** replaces the JSON dump",
        "A **bold\nacross lines** works.",
        "```\n**not markdown in a fence**x\n```",
        "Inline `**code**x` is ignored.",
        "<!-- **comment**x -->",
        "| a | **cell** |",
        "Escaped \\*\\* stays text.",
    ],
    ids=[
        "ja-fixed",
        "ja-bold-around-quote",
        "ja-code-spaced",
        "ja-url-spaced",
        "en-code-first",
        "multiline",
        "fence",
        "inline-code",
        "comment",
        "table",
        "escaped",
    ],
)
def test_passes_bold_that_renders(text: str) -> None:
    assert literal_strong_lines(text) == []


class _Report:
    def __init__(self) -> None:
        self.fails: list[str] = []
        self.notes: list[str] = []

    def fail(self, check: str, message: str, fixed: bool = False) -> None:
        self.fails.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)


def test_check_reports_file_and_line_and_what_it_scanned(tmp_path: Path) -> None:
    (tmp_path / "ja").mkdir()
    (tmp_path / "ja" / "a.md").write_text("ok\n\n演習の**「AIに質問」**。\n", encoding="utf-8")
    (tmp_path / "en").mkdir()
    (tmp_path / "en" / "b.md").write_text("**fine** text\n", encoding="utf-8")
    report = _Report()
    check_strong_emphasis(report, tmp_path)
    assert report.fails == ["ja/a.md:3: bold renders as literal ** in the in-app help"]
    assert report.notes == ["help-strong-emphasis: scanned 2 help pages"]


def test_check_fails_closed_without_pages(tmp_path: Path) -> None:
    report = _Report()
    check_strong_emphasis(report, tmp_path)
    assert len(report.fails) == 1 and "no help pages" in report.fails[0]


def test_repo_help_has_no_literal_bold() -> None:
    report = _Report()
    check_strong_emphasis(report, REPO / "docs" / "help")
    assert report.fails == []
