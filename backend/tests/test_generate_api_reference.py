"""Tests for the generated endpoint list of the help API reference (#3454).

The hand-written API pages covered a fraction of the routers and none of
three plugins while the README called the reference complete. The list now
comes from the committed OpenAPI snapshot; these tests pin that the render
names every operation, that drift between snapshot and pages is caught, and
that a missing or empty snapshot fails closed instead of writing an empty
page.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from generate_api_reference import (  # noqa: E402
    EXIT_FAIL_CLOSED,
    TEXT,
    check_api_reference,
    load_spec,
    operations,
    page_path,
    render,
    stale_pages,
)


def _spec(paths: dict) -> dict:
    return {"openapi": "3.1.0", "paths": paths}


SAMPLE = _spec(
    {
        "/api/users": {
            "get": {"tags": ["Users"], "summary": "List users"},
            "post": {"tags": ["Users"], "summary": "Create user"},
        },
        "/api/plugins/anki/export": {
            "post": {"tags": ["Anki"], "summary": "Export a | deck"},
        },
        "/api/health": {"get": {"summary": "Health"}},
        "/api/old": {"delete": {"tags": ["Users"], "summary": "Gone", "deprecated": True}},
    }
)


def _rows(page: str) -> list[str]:
    return [line for line in page.splitlines() if line.startswith("| `")]


def _tmp_repo(root: Path, spec: dict | None) -> Path:
    (root / "schema").mkdir(parents=True)
    if spec is not None:
        (root / "schema" / "openapi.json").write_text(json.dumps(spec), encoding="utf-8")
    return root


@pytest.mark.parametrize("lang", sorted(TEXT))
def test_render_lists_every_operation_once(lang: str) -> None:
    rows = _rows(render(SAMPLE, lang))
    assert len(rows) == len(operations(SAMPLE)) == 5


@pytest.mark.parametrize(
    ("needle", "why"),
    [
        ("| `POST` | `/api/plugins/anki/export` | Export a \\| deck |", "pipe escaped"),
        ("## Other", "untagged operation grouped under Other"),
        ("| `DELETE` | `/api/old` | Gone (deprecated) |", "deprecated marked"),
    ],
    ids=["pipe-escaped", "untagged-other", "deprecated-marked"],
)
def test_render_cells(needle: str, why: str) -> None:
    assert needle in render(SAMPLE, "en"), why


def test_render_orders_methods_within_a_path() -> None:
    rows = _rows(render(SAMPLE, "en"))
    users = [r for r in rows if "`/api/users`" in r]
    assert [r.split("`")[1] for r in users] == ["GET", "POST"]


def test_stale_pages_flags_a_drifted_page_and_passes_a_fresh_one(tmp_path: Path) -> None:
    repo = _tmp_repo(tmp_path, SAMPLE)
    for lang in TEXT:
        page_path(repo, lang).parent.mkdir(parents=True)
        page_path(repo, lang).write_text(render(SAMPLE, lang), encoding="utf-8")
    assert stale_pages(repo, SAMPLE) == []

    page_path(repo, "de").write_text("# hand-edited\n", encoding="utf-8")
    assert stale_pages(repo, SAMPLE) == [page_path(repo, "de")]


def test_stale_pages_flags_a_missing_page(tmp_path: Path) -> None:
    repo = _tmp_repo(tmp_path, SAMPLE)
    assert set(stale_pages(repo, SAMPLE)) == {page_path(repo, lang) for lang in TEXT}


@pytest.mark.parametrize(
    "spec",
    [None, _spec({}), _spec({"/api/x": {"parameters": []}})],
    ids=["missing-snapshot", "no-paths", "no-operation"],
)
def test_load_spec_fails_closed(tmp_path: Path, spec: dict | None) -> None:
    repo = _tmp_repo(tmp_path, spec)
    with pytest.raises(SystemExit) as exc:
        load_spec(repo)
    assert exc.value.code == EXIT_FAIL_CLOSED


def test_committed_pages_match_the_committed_snapshot() -> None:
    spec = load_spec(REPO)
    assert len(operations(spec)) > 100, "the snapshot looks truncated"
    assert stale_pages(REPO, spec) == [], (
        "run `python3 scripts/generate_api_reference.py` and commit the pages"
    )


class _Report:
    def __init__(self) -> None:
        self.fails: list[str] = []
        self.notes: list[str] = []

    def fail(self, check: str, message: str, fixed: bool = False) -> None:
        self.fails.append(f"{check}: {message}")

    def note(self, message: str) -> None:
        self.notes.append(message)


def test_verify_docs_check_fails_closed_without_a_snapshot(tmp_path: Path) -> None:
    report = _Report()
    check_api_reference(report, _tmp_repo(tmp_path, None))
    assert len(report.fails) == 1 and "basis missing" in report.fails[0]


def test_verify_docs_check_flags_drift_and_reports_what_it_measured(tmp_path: Path) -> None:
    repo = _tmp_repo(tmp_path, SAMPLE)
    for lang in TEXT:
        page_path(repo, lang).parent.mkdir(parents=True)
        page_path(repo, lang).write_text(render(SAMPLE, lang), encoding="utf-8")
    clean = _Report()
    check_api_reference(clean, repo)
    assert clean.fails == []
    assert clean.notes == ["api-reference: 5 operations against 2 generated pages"]

    page_path(repo, "en").write_text("# stale\n", encoding="utf-8")
    drifted = _Report()
    check_api_reference(drifted, repo)
    assert len(drifted.fails) == 1 and "docs/help/en/api/endpoints.md" in drifted.fails[0]
