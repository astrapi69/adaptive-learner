#!/usr/bin/env python3
"""Generate the app's lesson-format artefacts from the canonical engine
schema mirror (EXP-039 / D3b #1528; schema authority in the engine).

Source-of-truth chain: the `learn-content-engine
<https://github.com/astrapi69/learn-content-engine>`_ npm package is the
CANONICAL home of the lesson schema (immutable per published release);
``schema/lesson.schema.json`` + ``schema/content-manifest.schema.json``
in this repo are a BYTE MIRROR of the pinned engine release; the
structural Pydantic layer is REGENERATED from that mirror
(``scripts/generate_pydantic_models.py``) and only the semantic
cross-field validators are hand-written. This generator reads the mirror
(via ``adaptive_learner_content_loader.schema_export``) and emits the
derived artefacts. Everything it writes is a DERIVED artefact; never
hand-edit the outputs. A format change starts in the engine (or is
ratified there), then the pin is bumped and ``make sync-schema`` refreshes
the mirror and regenerates.

Outputs (all under ``<repo>/schema/``):

* ``content-set.schema.json``  -- the set schema (used by the content repo's CI)
* ``card.schema.json`` / ``exercise.schema.json`` / ``lesson-step.schema.json``

The three MIRROR-owned files (``lesson.schema.json``,
``content-manifest.schema.json``, ``quality-rules.json``) are NOT written
here. The engine ships them and ``sync_schema_mirror_from_engine`` copies
their bytes; a second writer would make the byte-parity gates compare two
producers instead of the mirror (#2265). The quality numbers are still READ
from the mirror for the frontend artefact.

The JSON is emitted with ``sort_keys=True`` so re-generation is byte-stable;
``--check`` re-generates into memory and diffs against the committed files,
failing (exit 1) on drift. This is the App-internal drift gate (analogous to
``make sync-versions-check``).

The byte-parity gates prove the app's ``schema/*.json`` equal the pinned
engine release: ``scripts/check_engine_schema_parity.py`` plus the
offline parity pin
``frontend/src/lib/content/validation/engine-schema-parity.test.ts``.
Red there means the mirror was hand-edited or the pin bump is stale. The
``$id`` points at the engine's schema URL; together with ``$schema`` +
``x-schema-version`` it makes the artefact self-describing for IDE
autocomplete (``$schema`` reference in a lesson .json) and for
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


# The shared quality minimums. The engine ships ``schema/quality-rules.json``
# (the mirror), so the ENGINE is canonical here too: read the numbers from
# the mirror rather than hard-coding a second copy. The frontend quality
# gate (content-validator.ts) and the content repo's validate_content.py
# both consume the same emitted quality-rules.json, so the numbers cannot
# drift across the places they used to be hard-coded.
def _load_quality_rules() -> dict[str, int]:
    data = json.loads((SCHEMA_DIR / "quality-rules.json").read_text(encoding="utf-8"))
    return data["rules"]


QUALITY_RULES: dict[str, int] = _load_quality_rules()


def _decorate(schema: dict[str, Any], slug: str) -> dict[str, Any]:
    """Add the 2020-12 ``$schema`` / ``$id`` / version header to a schema.

    The defaults come first and the mirror ``schema`` is spread LAST, so any
    ``$schema`` / ``$id`` / ``x-schema-version`` the mirror already carries
    WINS, so the emitted lesson/manifest schema stays byte-identical to the
    pinned engine release (``engine-parity-check``).
    """
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
            "> **Generated** from the canonical `learn-content-engine` schema "
            "mirror (`schema/lesson.schema.json`, a byte mirror of the pinned "
            "engine release) via `make sync-schema` (EXP-039). The app's "
            "structural Pydantic layer is regenerated from that mirror; only "
            "the semantic validators are hand-written. Do not edit by hand; a "
            "format change starts in the engine, then the pin is bumped and the "
            "generator re-runs.\n\n"
            f"Schema version: **{CURRENT_SCHEMA_VERSION}** "
            "(JSON Schema 2020-12). The machine-readable schema lives at "
            "`schema/lesson.schema.json`; reference it from a lesson `.json` via "
            '`"$schema"` for IDE autocomplete + validation.\n\n'
            "Field descriptions below come verbatim from the model definitions.\n"
        ),
        "de": (
            "# Lektionsformat-Referenz\n\n"
            "> **Generiert** aus dem kanonischen `learn-content-engine`-"
            "Schemaspiegel (`schema/lesson.schema.json`, ein Byte-Spiegel des "
            "gepinnten Engine-Release) via `make sync-schema` (EXP-039). Die "
            "strukturelle Pydantic-Schicht der App wird aus diesem Spiegel "
            "regeneriert; nur die semantischen Validatoren sind handgeschrieben. "
            "Nicht von Hand editieren; eine Formatänderung beginnt in der "
            "Engine, dann wird der Pin erhöht und der Generator läuft erneut.\n\n"
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
    body = ",\n".join(f"  {k}: {v}" for k, v in sorted(QUALITY_RULES.items()))
    return (
        "// GENERATED from scripts/generate_lesson_schema.py (EXP-039). DO NOT EDIT.\n"
        "// Shared content quality minimums. The numbers come from the engine\n"
        "// mirror schema/quality-rules.json, re-emitted here for the frontend and\n"
        "// carried by the content repo too. Refresh via `make sync-schema`.\n\n"
        "/** Quality minimums. Below any of these = cannot share. */\n"
        f"export const QUALITY = {{\n{body},\n}} as const;\n"
    )


def build_artefacts() -> dict[str, str]:
    """Return ``{repo-relative path: text}`` for every generated artefact."""
    # NOT emitted here: lesson.schema.json, content-manifest.schema.json and
    # quality-rules.json. Those are MIRROR-owned (see
    # ``sync_schema_mirror_from_engine.MIRRORED``) - the engine ships them and
    # the mirror copies its bytes. This generator used to re-emit them from its
    # own serializer, which made the byte-parity gates compare two producers
    # rather than the mirror; that only ever passed because the engine happened
    # to serialize the same way up to 0.14.0 (#2265). Pinned by
    # ``backend/tests/test_schema_single_writer.py``.
    schemas = {
        "content-set.schema.json": _decorate(set_schema(), "content-set.schema.json"),
        "card.schema.json": _decorate(card_schema(), "card.schema.json"),
        "exercise.schema.json": _decorate(exercise_schema(), "exercise.schema.json"),
        "lesson-step.schema.json": _decorate(lesson_step_schema(), "lesson-step.schema.json"),
    }
    artefacts: dict[str, str] = {
        f"{SCHEMA_REL}/{name}": _json(schema) for name, schema in schemas.items()
    }
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
