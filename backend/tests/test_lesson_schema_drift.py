"""Drift gate for the EXP-039 generated lesson-schema artefacts.

The lesson JSON-Schema, the shared quality-rules, the generated frontend
quality-rules module, and the human-readable reference doc are all DERIVED
from the Pydantic models (``adaptive_learner_content_loader.schema``). This
test re-runs the generator in memory and asserts the committed files match —
so a change to the models that is not followed by ``make sync-schema`` fails
here (and in CI), exactly like ``sync-versions-check``.

The TS interface types (``lesson-schema.generated.ts``) are produced by a
Node generator and are drift-checked separately in the frontend CI job.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
GENERATOR = REPO_ROOT / "scripts" / "generate_lesson_schema.py"


def _load_generator():
    spec = importlib.util.spec_from_file_location("generate_lesson_schema", GENERATOR)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "rel",
    [
        "schema/lesson.schema.json",
        "schema/quality-rules.json",
        "frontend/src/lib/content/validation/quality-rules.generated.ts",
        "docs/help/en/developer/lesson-format-reference.md",
        "docs/help/de/developer/lesson-format-reference.md",
    ],
)
def test_generated_artefact_matches_committed(rel: str) -> None:
    generator = _load_generator()
    artefacts = generator.build_artefacts()
    expected = artefacts[rel]
    committed = (REPO_ROOT / rel).read_text(encoding="utf-8")
    assert committed == expected, (
        f"{rel} is out of date with the Pydantic models. Run `make sync-schema`."
    )


def test_all_artefacts_present() -> None:
    generator = _load_generator()
    for rel in generator.build_artefacts():
        assert (REPO_ROOT / rel).is_file(), f"missing generated artefact: {rel}"
