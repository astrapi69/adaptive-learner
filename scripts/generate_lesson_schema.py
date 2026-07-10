#!/usr/bin/env python3
"""Generate the app's lesson-format artefacts, conform to the canonical
engine schema (EXP-039; schema authority in the engine since #1517).

Source-of-truth chain: the `learn-content-engine
<https://github.com/astrapi69/learn-content-engine>`_ npm package is the
CANONICAL home of the lesson schema (immutable per published release);
this app generates conforming artefacts from its Pydantic models in
``adaptive_learner_content_loader.schema`` (Pydantic is the app's
editorial + runtime tool, not the authority); the content repos mirror
THE ENGINE RELEASE (pinned). Everything this script writes is a DERIVED
artefact — never hand-edit the outputs; a format change starts in the
engine (or is ratified there), then the Pydantic models follow and this
generator re-runs via ``make sync-schema``.

Outputs (all under ``<repo>/schema/``):

* ``lesson.schema.json``       -- JSON Schema 2020-12 for a whole lesson
* ``content-manifest.schema.json`` / ``content-set.schema.json`` -- the
  set/manifest schemas (used by the content repo's CI)
* ``card.schema.json`` / ``exercise.schema.json`` / ``lesson-step.schema.json``
* ``quality-rules.json``       -- the shared quality minimums (content
  repo + app read the same numbers)

The JSON is emitted with ``sort_keys=True`` so re-generation is byte-stable;
``--check`` re-generates into memory and diffs against the committed files,
failing (exit 1) on drift. This is the App-internal drift gate (analogous to
``make sync-versions-check``).

The byte-parity gates prove the app-generated artefacts equal the pinned
engine release: ``scripts/check_engine_schema_parity.py`` plus the
offline parity pin
``frontend/src/lib/content/validation/engine-schema-parity.test.ts``.
Red there means the Pydantic models moved without the engine-first
procedure. The ``$id`` points at the engine's schema URL; together with
``$schema`` + ``x-schema-version`` it makes the artefact self-describing
for IDE autocomplete (``$schema`` reference in a lesson .json) and for
``jsonschema``/``ajv`` validation.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from adaptive_learner_content_loader.models import CURRENT_SCHEMA_VERSION
from adaptive_learner_content_loader.schema_export import (
    card_schema,
    exercise_schema,
    lesson_schema,
    lesson_step_schema,
    manifest_schema,
    set_schema,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = REPO_ROOT / "schema"
SCHEMA_REL = "schema"
DOC_REL = {
    "en": "docs/help/en/developer/lesson-format-reference.md",
    "de": "docs/help/de/developer/lesson-format-reference.md",
}
FRONTEND_QUALITY_REL = "frontend/src/lib/content/validation/quality-rules.generated.ts"

DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema"
SCHEMA_ID_BASE = "https://astrapi69.github.io/learn-content-engine/schema"

# The shared quality minimums. THIS is the canonical definition; the
# frontend quality gate (content-validator.ts) and the content repo's
# validate_content.py both consume the emitted quality-rules.json so the
# numbers cannot drift across the three places they used to be hard-coded.
QUALITY_RULES: dict[str, int] = {
    "minExercisesPerLesson": 5,
    "minExerciseTypes": 2,
    "minFreeTextAccepts": 2,
    "minMatchingPairs": 3,
    "minTheorySteps": 1,
}


def _decorate(schema: dict[str, Any], slug: str) -> dict[str, Any]:
    """Add the 2020-12 ``$schema`` / ``$id`` / version header to a model schema."""
    decorated = {
        "$schema": DRAFT_2020_12,
        "$id": f"{SCHEMA_ID_BASE}/{slug}",
        "x-schema-version": CURRENT_SCHEMA_VERSION,
        **schema,
    }
    return decorated


def _json(payload: Any) -> str:
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def _ts_type(prop: dict[str, Any]) -> str:
    """Render a compact TS-ish type hint for a JSON-Schema property node."""
    if "$ref" in prop:
        return prop["$ref"].rsplit("/", 1)[-1]
    if "anyOf" in prop:
        return " | ".join(_ts_type(p) for p in prop["anyOf"])
    if "enum" in prop:
        return " | ".join(json.dumps(v) for v in prop["enum"])
    kind = prop.get("type")
    if kind == "array":
        return f"{_ts_type(prop.get('items', {}))}[]"
    if kind == "object":
        addl = prop.get("additionalProperties")
        if isinstance(addl, dict):
            return f"{{ [k: string]: {_ts_type(addl)} }}"
        return "object"
    if kind == "null":
        return "null"
    if isinstance(kind, str):
        return {"integer": "number", "boolean": "boolean", "number": "number"}.get(kind, kind)
    return "unknown"


def _constraints(prop: dict[str, Any]) -> str:
    bits = []
    for key, label in (
        ("minLength", "minLen"),
        ("maxLength", "maxLen"),
        ("minimum", "min"),
        ("maximum", "max"),
        ("minItems", "minItems"),
        ("maxItems", "maxItems"),
    ):
        if key in prop:
            bits.append(f"{label}={prop[key]}")
    return ", ".join(bits)


def _model_section(name: str, node: dict[str, Any], required: list[str]) -> str:
    lines = [f"### `{name}`", ""]
    desc = (node.get("description") or "").strip()
    if desc:
        lines.append(desc.split("\n\n")[0].replace("\n", " "))
        lines.append("")
    props = node.get("properties", {})
    if not props:
        return "\n".join(lines) + "\n"
    lines.append("| Field | Type | Required | Constraints |")
    lines.append("|-------|------|----------|-------------|")
    for field in sorted(props):
        prop = props[field]
        req = "yes" if field in required else "no"
        lines.append(f"| `{field}` | `{_ts_type(prop)}` | {req} | {_constraints(prop) or '-'} |")
    lines.append("")
    return "\n".join(lines) + "\n"


def build_doc(lang: str) -> str:
    """Render the human-readable lesson-format reference from the lesson schema."""
    schema = _decorate(lesson_schema(), "lesson.schema.json")
    intro = {
        "en": (
            "# Lesson format reference\n\n"
            "> **Generated** from the app's Pydantic models "
            "(`adaptive_learner_content_loader.schema`) via "
            "`make sync-schema` (EXP-039). The canonical schema home is the "
            "`learn-content-engine` npm package; the models conform to it "
            "(byte-parity gated). Do not edit by hand — a format change starts "
            "in the engine, then the models follow and the generator re-runs.\n\n"
            f"Schema version: **{CURRENT_SCHEMA_VERSION}** "
            "(JSON Schema 2020-12). The machine-readable schema lives at "
            "`schema/lesson.schema.json`; reference it from a lesson `.json` via "
            '`"$schema"` for IDE autocomplete + validation.\n\n'
            "Field descriptions below come verbatim from the model definitions.\n"
        ),
        "de": (
            "# Lektionsformat-Referenz\n\n"
            "> **Generiert** aus den Pydantic-Modellen der App "
            "(`adaptive_learner_content_loader.schema`) via "
            "`make sync-schema` (EXP-039). Die kanonische Heimat des Schemas ist "
            "das npm-Paket `learn-content-engine`; die Modelle sind dazu konform "
            "(byte-genau gegated). Nicht von Hand editieren — eine "
            "Formatänderung beginnt in der Engine, dann folgen die Modelle und "
            "der Generator läuft erneut.\n\n"
            f"Schema-Version: **{CURRENT_SCHEMA_VERSION}** "
            "(JSON Schema 2020-12). Das maschinenlesbare Schema liegt unter "
            "`schema/lesson.schema.json`; referenziere es aus einer Lektions-"
            '`.json` via `"$schema"` fuer IDE-Autocomplete + Validierung.\n\n'
            "Die Feldbeschreibungen stammen woertlich aus den Modelldefinitionen "
            "(englisch).\n"
        ),
    }[lang]
    heading = {"en": "## Models", "de": "## Modelle"}[lang]
    sections = [intro, "", heading, ""]
    sections.append(_model_section("Lesson", schema, schema.get("required", [])))
    for def_name in sorted(schema.get("$defs", {})):
        node = schema["$defs"][def_name]
        if node.get("type") == "object":
            sections.append(_model_section(def_name, node, node.get("required", [])))
        elif "enum" in node:
            values = " · ".join(f"`{v}`" for v in node["enum"])
            sections.append(f"### `{def_name}` (enum)\n\n{values}\n")
    return "\n".join(sections).rstrip() + "\n"


def build_frontend_quality_rules() -> str:
    body = ",\n".join(f"  {k}: {v}" for k, v in QUALITY_RULES.items())
    return (
        "// GENERATED from scripts/generate_lesson_schema.py (EXP-039). DO NOT EDIT.\n"
        "// Shared content quality minimums — the single source is the Python\n"
        "// generator; schema/quality-rules.json carries the same numbers for the\n"
        "// content repo. Edit the generator + run `make sync-schema`.\n\n"
        "/** Quality minimums. Below any of these = cannot share. */\n"
        f"export const QUALITY = {{\n{body},\n}} as const;\n"
    )


def build_artefacts() -> dict[str, str]:
    """Return ``{repo-relative path: text}`` for every generated artefact."""
    schemas = {
        "lesson.schema.json": _decorate(lesson_schema(), "lesson.schema.json"),
        "content-manifest.schema.json": _decorate(
            manifest_schema(), "content-manifest.schema.json"
        ),
        "content-set.schema.json": _decorate(set_schema(), "content-set.schema.json"),
        "card.schema.json": _decorate(card_schema(), "card.schema.json"),
        "exercise.schema.json": _decorate(exercise_schema(), "exercise.schema.json"),
        "lesson-step.schema.json": _decorate(lesson_step_schema(), "lesson-step.schema.json"),
    }
    artefacts: dict[str, str] = {
        f"{SCHEMA_REL}/{name}": _json(schema) for name, schema in schemas.items()
    }
    artefacts[f"{SCHEMA_REL}/quality-rules.json"] = _json(
        {
            "$schema-version": CURRENT_SCHEMA_VERSION,
            "_comment": (
                "GENERATED from scripts/generate_lesson_schema.py (EXP-039). "
                "Do not edit. Shared quality minimums for the content quality "
                "gate (app + content repo)."
            ),
            "rules": QUALITY_RULES,
        }
    )
    artefacts[FRONTEND_QUALITY_REL] = build_frontend_quality_rules()
    for lang, rel in DOC_REL.items():
        artefacts[rel] = build_doc(lang)
    return artefacts


def write(artefacts: dict[str, str]) -> None:
    for rel, text in artefacts.items():
        path = REPO_ROOT / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")


def check(artefacts: dict[str, str]) -> int:
    """Diff the freshly-built artefacts against the committed files."""
    drift: list[str] = []
    for rel, text in artefacts.items():
        path = REPO_ROOT / rel
        if not path.is_file():
            drift.append(f"{rel}: missing (run `make sync-schema`)")
            continue
        if path.read_text(encoding="utf-8") != text:
            drift.append(f"{rel}: out of date (run `make sync-schema`)")
    if drift:
        print("Schema drift detected:", file=sys.stderr)
        for item in drift:
            print(f"  - {item}", file=sys.stderr)
        return 1
    print(f"Schema artefacts up to date ({len(artefacts)} files).")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify committed artefacts match the models; non-zero on drift.",
    )
    args = parser.parse_args()
    artefacts = build_artefacts()
    if args.check:
        return check(artefacts)
    write(artefacts)
    print(f"Wrote {len(artefacts)} generated artefact(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
