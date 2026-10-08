"""Drift gate for the EXP-039 generated lesson-schema artefacts.

The EXTRACTED sub-schemas, the generated frontend quality-rules module, and
the human-readable reference doc are all DERIVED from the mirror via
``adaptive_learner_content_loader.schema_export``. The mirror-owned files are
covered by the byte-parity gate instead (#2265, single writer per path). This
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
        # NOT listed: schema/lesson.schema.json, content-manifest.schema.json
        # and quality-rules.json. Those are MIRROR-owned since #2265 - the
        # engine ships them, the mirror copies the bytes, and their gate is the
        # byte-parity check (test_engine_schema_parity.py), not this drift
        # test. A second writer here made the parity gate compare two
        # producers instead of the mirror.
        "schema/content-set.schema.json",
        "schema/card.schema.json",
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


# #3647 - the reference page exists in every help locale, written by the
# generator alone, so a translated locale never falls back to the German page
# and never gains a hand-written second writer of a generated path (#2265).

HELP_ROOT = REPO_ROOT / "docs" / "help"
MARKER = "<!-- Translation: AI-generated, pending native review -->"
REFERENCE = "developer/lesson-format-reference.md"


def _help_locales() -> list[str]:
    return sorted(
        p.name for p in HELP_ROOT.iterdir() if p.is_dir() and not p.name.startswith(("_", "."))
    )


def test_help_locales_found() -> None:
    """Guard the guard: an empty locale scan would make the checks below vacuous."""
    assert {"en", "de"} < set(_help_locales())
    assert len(_help_locales()) >= 3


@pytest.mark.parametrize("locale", _help_locales())
def test_every_help_locale_gets_a_generated_reference(locale: str) -> None:
    rel = f"docs/help/{locale}/{REFERENCE}"
    artefacts = _load_generator().build_artefacts()
    assert rel in artefacts, f"the generator writes no {REFERENCE} for {locale}"
    assert (REPO_ROOT / rel).read_text(encoding="utf-8") == artefacts[rel], (
        f"{rel} is out of date. Run `make sync-schema`."
    )


@pytest.mark.parametrize("locale", _help_locales())
def test_reference_carries_the_locale_marker_convention(locale: str) -> None:
    """The page follows its locale: marked where the locale's index page is marked."""
    index_marked = (HELP_ROOT / locale / "index.md").read_text(encoding="utf-8").startswith(MARKER)
    page = _load_generator().build_doc(locale)
    assert page.startswith(MARKER) == index_marked


@pytest.mark.parametrize("locale", _help_locales())
def test_reference_model_sections_match_english(locale: str) -> None:
    """Only the intro and the models heading are translated; the tables are the schema's."""
    generator = _load_generator()

    def models(text: str) -> str:
        return text.split("\n### ", 1)[1]

    assert models(generator.build_doc(locale)) == models(generator.build_doc("en"))
