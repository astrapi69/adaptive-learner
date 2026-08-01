"""Every schema artefact has exactly ONE writer (#2265).

``schema/lesson.schema.json``, ``schema/content-manifest.schema.json`` and
``schema/quality-rules.json`` are a BYTE MIRROR of the pinned engine release.
Until this test existed, TWO tools wrote them: ``sync_schema_mirror_from_engine``
copied the engine bytes, and ``generate_lesson_schema`` then re-emitted the same
documents from its own serializer.

That worked only by coincidence. Up to engine 0.14.0 the engine happened to
serialize with ``sort_keys=True`` and ASCII escaping, which is exactly what the
app's generator produces, so the byte-parity gates were green. Engine 0.16.x
switched to insertion order and literal UTF-8; the documents stayed
semantically identical while the bytes diverged, and both gates went red
without any content having changed.

The lesson is not "make the two writers agree again" — it is that the gate was
never checking the mirror. It was checking that two independent producers
happened to emit the same bytes. This test removes the coincidence: the
generator must not write any path the mirror owns.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = REPO_ROOT / "scripts"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_generator_writes_no_mirror_owned_path() -> None:
    """The mirror owns its files; the generator only derives the others."""
    mirror = _load("sync_schema_mirror_from_engine")
    generator = _load("generate_lesson_schema")

    mirror_owned = {f"schema/{name}" for name in mirror.MIRRORED}
    written = set(generator.build_artefacts())
    overlap = mirror_owned & written

    assert not overlap, (
        "these paths have two writers (mirror + generator), so the byte-parity "
        f"gate compares two producers instead of the mirror: {sorted(overlap)}"
    )


def test_mirror_owned_set_is_not_empty() -> None:
    """Guard the guard: an empty MIRRORED set would make the test above pass
    for the wrong reason (nothing to overlap with)."""
    mirror = _load("sync_schema_mirror_from_engine")
    assert len(mirror.MIRRORED) >= 3


def test_generator_still_produces_its_derived_artefacts() -> None:
    """Dropping the mirrored paths must not silently drop everything else.

    The derived schemas are EXTRACTED sub-documents that the engine does not
    ship as standalone files, so the generator remains their only source.
    """
    generator = _load("generate_lesson_schema")
    written = set(generator.build_artefacts())
    for rel in (
        "schema/content-set.schema.json",
        "schema/card.schema.json",
        "schema/exercise.schema.json",
        "schema/lesson-step.schema.json",
        "frontend/src/lib/content/validation/quality-rules.generated.ts",
        "docs/help/en/developer/lesson-format-reference.md",
        "docs/help/de/developer/lesson-format-reference.md",
    ):
        assert rel in written, f"generator stopped producing {rel}"


def test_mirror_owned_files_carry_their_decorations_from_the_engine() -> None:
    """Nothing the generator used to add on the side is lost.

    ``_decorate`` added ``$schema`` / ``$id`` / ``x-schema-version`` defaults,
    spreading the mirror last so the mirror won when it carried them. The
    pinned engine DOES carry all three, so dropping the generator from these
    paths removes a no-op, not a contribution.
    """
    import json

    for name in ("lesson.schema.json", "content-manifest.schema.json"):
        doc = json.loads((REPO_ROOT / "schema" / name).read_text(encoding="utf-8"))
        for key in ("$schema", "$id", "x-schema-version"):
            assert key in doc, f"{name} lost {key} when the generator stopped writing it"
