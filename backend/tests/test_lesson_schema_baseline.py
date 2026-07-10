"""Byte-baseline gate for the schema-authority migration (Phase 0, #1516).

The migration "Schema-Autoritaet von der App in die Engine verlegen"
(decisions D1a/D2/D3a) moves the canonical home of the lesson format
from this app to the ``learn-content-engine`` npm package. Its top rule:
NO schema CONTENT may change along the way — same exercise types, same
fields, same enums, same constraints. Only ``$id`` (which flips to the
engine-own URL in Phase 2) and the version signal may differ.

This test freezes today's generated schemas
(``fixtures/lesson-schema-baseline/schema.baseline.json``) and compares
the CURRENTLY generated output of ``scripts/generate_lesson_schema.py``
against that frozen state, normalised by stripping exactly the two
allowed-to-change keys (top-level ``$id`` + ``x-schema-version``). It
stays green through every migration phase and turns red on any creeping
content change.

Once the migration is complete this baseline can be retired in favour of
the engine parity gates (``test_engine_schema_parity.py`` and friends),
which pin the app byte-exactly to the pinned engine release.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS_DIR = REPO_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

import generate_lesson_schema as generator  # noqa: E402

BASELINE_FILE = (
    Path(__file__).parent / "fixtures" / "lesson-schema-baseline" / "schema.baseline.json"
)

# The two engine-bundled artefacts, exactly the ``COMPARED`` surface of
# scripts/check_engine_schema_parity.py.
FROZEN_ARTEFACTS = ("lesson.schema.json", "content-manifest.schema.json")

# The ONLY keys allowed to differ from the frozen baseline during the
# migration ($id flips to the engine-own URL in Phase 2; the version
# signal is coordinated separately). Everything else is content.
ALLOWED_TO_CHANGE = ("$id", "x-schema-version")


def _normalise(schema: dict[str, Any]) -> dict[str, Any]:
    """Drop exactly the allowed-to-change top-level keys."""
    return {key: value for key, value in schema.items() if key not in ALLOWED_TO_CHANGE}


def _generated(name: str) -> dict[str, Any]:
    """Regenerate one schema artefact in memory from the Pydantic models."""
    return json.loads(generator.build_artefacts()[f"schema/{name}"])


def _baseline(name: str) -> dict[str, Any]:
    """Load one frozen schema artefact from the baseline file."""
    return json.loads(BASELINE_FILE.read_text(encoding="utf-8"))[name]


@pytest.mark.parametrize("name", FROZEN_ARTEFACTS)
def test_generated_schema_matches_frozen_baseline(name: str) -> None:
    """The Pydantic-generated schema content equals the frozen baseline.

    Red means: a Pydantic model change altered the schema CONTENT during
    the schema-authority migration — forbidden by the migration's top
    rule. Either revert the change or, if it is an intentional format
    change, land it through the engine-first procedure and refresh this
    baseline explicitly.
    """
    assert _normalise(_generated(name)) == _normalise(_baseline(name))


@pytest.mark.parametrize("name", FROZEN_ARTEFACTS)
def test_baseline_normalisation_strips_only_id_and_version(name: str) -> None:
    """Guard the normalisation itself: it removes exactly $id + x-schema-version.

    If the generator ever stopped emitting one of the two decoration
    keys, the baseline comparison could silently widen its blind spot;
    this pin keeps the normalised surface honest.
    """
    baseline = _baseline(name)
    for key in ALLOWED_TO_CHANGE:
        assert key in baseline, f"baseline {name} lost its '{key}' decoration"
    normalised = _normalise(baseline)
    assert set(baseline) - set(normalised) == set(ALLOWED_TO_CHANGE)
