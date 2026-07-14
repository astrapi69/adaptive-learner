"""JSON Schema export for the Content-Loader's data models
(Phase 43 / EXP-002 / 2B - P-103; mirror source since D3b, #1528).

Used by:

- External editors / IDE plugins so a content author can
  validate their manifest.yaml + lesson .json files BEFORE
  pushing a PR to the content repo.
- The content repo's CI: a GitHub-Actions workflow runs the
  same JSON Schemas against every file in ``sets/`` on every
  PR.
- The Content-Loader CLI (Phase 44+) for ``adaptive-learner
  content validate <path>`` style commands.

Source-of-truth chain: the ``learn-content-engine`` npm package is the
CANONICAL home of the lesson format; ``schema/lesson.schema.json`` and
``schema/content-manifest.schema.json`` in this repo are a byte mirror of
the pinned engine release. Since D3b (#1528) the structural Pydantic
models are GENERATED from that mirror, so the exports below read the
MIRROR - not ``model_json_schema()`` - to stay the one source:

- ``lesson_schema`` / ``manifest_schema`` load the mirror file directly.
- ``card`` / ``exercise`` / ``lesson_step`` / ``set`` extract the matching
  ``$defs`` node (plus its transitively referenced ``$defs``) out of the
  mirror as a standalone schema.

The export is JSON, NOT JSON-Schema-with-draft-suffix -- the engine emits
a 2020-12-draft document and that's what the mirror carries. External
tooling (ajv, jsonschema, yajsv) supports the 2020-12 draft.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Repo-root schema mirror (``<repo>/schema``). ``parents[3]`` walks
# schema_export.py -> adaptive_learner_content_loader ->
# adaptive-learner-plugin-content-loader -> plugins -> repo root. Callers
# that run against an INSTALLED package (not the repo layout) can pass an
# explicit ``schema_dir``.
MIRROR_DIR = Path(__file__).resolve().parents[3] / "schema"

LESSON_MIRROR = "lesson.schema.json"
MANIFEST_MIRROR = "content-manifest.schema.json"


def _load(name: str, schema_dir: Path | None = None) -> dict[str, Any]:
    """Load one mirror schema file as a dict."""
    base = schema_dir if schema_dir is not None else MIRROR_DIR
    return json.loads((base / name).read_text(encoding="utf-8"))


def _referenced_defs(root: dict[str, Any], all_defs: dict[str, Any]) -> dict[str, Any]:
    """Return the ``$defs`` transitively referenced from ``root``.

    Walks every ``$ref: "#/$defs/X"`` reachable from ``root`` and collects
    the referenced definitions (and the definitions THEY reference, ...)
    so an extracted sub-schema keeps every ``$ref`` resolvable within its
    own ``$defs``.
    """
    needed: set[str] = set()

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            ref = node.get("$ref")
            if isinstance(ref, str) and ref.startswith("#/$defs/"):
                name = ref.rsplit("/", 1)[-1]
                if name not in needed and name in all_defs:
                    needed.add(name)
                    visit(all_defs[name])
            for value in node.values():
                visit(value)
        elif isinstance(node, list):
            for value in node:
                visit(value)

    visit(root)
    return {name: all_defs[name] for name in sorted(needed)}


def _extract(source: str, def_name: str, schema_dir: Path | None = None) -> dict[str, Any]:
    """Extract one ``$defs`` node from a mirror file as a standalone schema.

    The node becomes the schema root; its transitively referenced ``$defs``
    are carried along so the ``#/$defs/...`` pointers still resolve.
    """
    doc = _load(source, schema_dir)
    all_defs = doc.get("$defs", {})
    root = dict(all_defs[def_name])
    sub_defs = _referenced_defs(root, all_defs)
    sub_defs.pop(def_name, None)  # a self-ref stays a dangling #/$defs pointer at worst
    if sub_defs:
        root["$defs"] = sub_defs
    return root


def manifest_schema(schema_dir: Path | None = None) -> dict[str, Any]:
    """Return the JSON Schema for ``ContentManifest`` (mirror file)."""
    return _load(MANIFEST_MIRROR, schema_dir)


def set_schema(schema_dir: Path | None = None) -> dict[str, Any]:
    """Return the JSON Schema for ``ContentSet`` (extracted from the manifest mirror)."""
    return _extract(MANIFEST_MIRROR, "ContentSet", schema_dir)


def lesson_schema(schema_dir: Path | None = None) -> dict[str, Any]:
    """Return the JSON Schema for ``Lesson`` (mirror file).

    The lesson mirror inlines ``LessonStep``, ``Exercise``, ``Card``,
    ``ExerciseType``, ``StepType`` etc. under ``$defs``. External content
    editors validate a whole lesson .json against this one schema.
    """
    return _load(LESSON_MIRROR, schema_dir)


def card_schema(schema_dir: Path | None = None) -> dict[str, Any]:
    """Return the JSON Schema for ``Card`` in isolation (extracted from the mirror).

    Useful for the planned cross-lesson shared-card store
    (P-111 territory) where individual cards live in their own files.
    """
    return _extract(LESSON_MIRROR, "Card", schema_dir)


def exercise_schema(schema_dir: Path | None = None) -> dict[str, Any]:
    """Return the JSON Schema for ``Exercise`` in isolation (extracted from the mirror).

    Useful for content authors who want to write exercises once and
    reference them from multiple lessons (planned for the Phase 44+
    shared exercise pool).
    """
    return _extract(LESSON_MIRROR, "Exercise", schema_dir)


def lesson_step_schema(schema_dir: Path | None = None) -> dict[str, Any]:
    """Return the JSON Schema for ``LessonStep`` in isolation (extracted from the mirror).

    Not directly consumed by the content authoring flow, but used by the
    Phase 44 viewer when it parses partial step payloads streamed from
    the cache.
    """
    return _extract(LESSON_MIRROR, "LessonStep", schema_dir)


def write_schemas(out_dir: Path) -> dict[str, Path]:
    """Materialise every schema as a JSON file under ``out_dir``.

    Returns a mapping of schema name -> written path so callers
    (CI workflows, release scripts) can verify the file set.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    written: dict[str, Path] = {}
    for name, schema in (
        ("content-manifest.schema.json", manifest_schema()),
        ("content-set.schema.json", set_schema()),
        ("lesson.schema.json", lesson_schema()),
        ("card.schema.json", card_schema()),
        ("exercise.schema.json", exercise_schema()),
        ("lesson-step.schema.json", lesson_step_schema()),
    ):
        target = out_dir / name
        target.write_text(
            json.dumps(schema, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        written[name] = target
    return written
