"""Cross-language parity for the set-entry projection (#3711).

A manifest set entry reaches the app through two projections written by
hand: ``SetEntryResponse.from_entry`` over the content-loader's
``ContentSet`` here (API mode) and the engine's ``asContentSetEntry`` (Dexie
mode). ``engine-parity-check`` compares schema bytes only and sees neither.
Both sides run the SAME case file,
``tests/fixtures/set-entry-parity/cases.json``, and compare their whole
output against the expected entry: field set, values, and absence. A field
added to one projection without a case fails here or in
``frontend/src/lib/content/engine/set-entry.parity.test.ts``.

The case file is hand-written from the manifest contract, never regenerated
from either implementation. A case with a ``python`` block declares where
this side differs from the engine, with the reason.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from adaptive_learner_content_loader.models import ContentSet
from adaptive_learner_content_loader.routes import SetEntryResponse
from adaptive_learner_content_loader.service import SetEntry
from pydantic import ValidationError

CASES_PATH = (
    Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "set-entry-parity" / "cases.json"
)
CASE_FILE: dict[str, Any] = json.loads(CASES_PATH.read_text(encoding="utf-8"))
CASES: list[dict[str, Any]] = CASE_FILE["cases"]


def _expected_for_python(case: dict[str, Any]) -> dict[str, Any]:
    """The expected entry as this side sees it: fields owned by the other
    side dropped, declared overrides applied."""
    only_in: dict[str, str] = CASE_FILE["only_in"]
    expected = {
        field: value for field, value in case["expected"].items() if only_in.get(field) != "ts"
    }
    declared = case.get("python") or {}
    if declared.get("outcome") == "projected":
        expected.update(declared["overrides"])
    return expected


def _project(entry: dict[str, Any]) -> dict[str, Any]:
    """Project one manifest set entry the way the API loader does."""
    context = CASE_FILE["context"]
    content_set = ContentSet.model_validate(dict(entry))
    set_entry = SetEntry(
        source=context["source"],
        branch=context["branch"],
        set=content_set,
        cached_version=context["cached_version"],
        update_available=False,
        downloaded_at=context["downloaded_at"],
    )
    projected: dict[str, Any] = SetEntryResponse.from_entry(set_entry).model_dump(mode="json")
    return projected


def test_case_file_is_not_empty() -> None:
    assert CASES, f"no cases in {CASES_PATH}"


def test_every_divergence_carries_a_reason() -> None:
    undeclared = [case["name"] for case in CASES if "python" in case and not case.get("divergence")]
    assert not undeclared, f"divergences without a reason: {undeclared}"


@pytest.mark.parametrize("case", CASES, ids=[case["name"] for case in CASES])
def test_set_entry_projection_matches_case(case: dict[str, Any]) -> None:
    declared = case.get("python") or {}
    if declared.get("outcome") == "rejected":
        with pytest.raises(ValidationError):
            _project(case["entry"])
        return
    assert _project(case["entry"]) == _expected_for_python(case)
