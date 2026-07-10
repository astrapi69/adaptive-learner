#!/usr/bin/env python3
"""Generate the STRUCTURAL Pydantic models from the engine schema (D3b, #1528).

Source-of-truth chain: the ``learn-content-engine`` npm package is the
canonical home of the lesson format; ``schema/lesson.schema.json`` and
``schema/content-manifest.schema.json`` in this repo are a byte mirror of
the pinned engine release. This script derives the structural Pydantic
layer from that mirror via ``datamodel-code-generator``, so field
definitions can no longer drift from the canonical schema (the same
principle as the engine's own TS type generator, engine 0.6.1).

The SEMANTIC cross-field validators (matching/cloze/multiple_choice
rules, referential integrity, slug/BCP-47/semver checks) are NOT
generated - JSON-Schema cannot express them. They live in ``schema.py``
/ ``models.py`` as thin subclasses of the generated models (the engine
keeps its semantic layer hand-written in ``validate.ts`` for the same
reason).

Outputs (both ``GENERATED ... DO NOT EDIT``):

* plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/schema_generated.py
* plugins/adaptive-learner-plugin-content-loader/adaptive_learner_content_loader/manifest_generated.py

Usage (via ``make sync-schema`` / ``make sync-schema-check``):
    poetry run python ../scripts/generate_pydantic_models.py           # write
    poetry run python ../scripts/generate_pydantic_models.py --check   # exit 1 on drift
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_DIR = (
    REPO_ROOT
    / "plugins"
    / "adaptive-learner-plugin-content-loader"
    / "adaptive_learner_content_loader"
)

# (input schema, output module, root class name)
TARGETS = [
    (REPO_ROOT / "schema" / "lesson.schema.json", "schema_generated.py", "Lesson"),
    (
        REPO_ROOT / "schema" / "content-manifest.schema.json",
        "manifest_generated.py",
        "ContentManifest",
    ),
]

HEADER = """\
# GENERATED from {source} via scripts/generate_pydantic_models.py
# (D3b, #1528). DO NOT EDIT.
#
# Structural layer only - the semantic cross-field validators live in
# the hand-written subclasses (schema.py / models.py). Regenerate via
# `make sync-schema` after an engine re-pin refreshed the mirror."""

# The evaluated flag set (equivalence probe: 0 divergences vs the former
# hand-written model at engine 0.8.2). Do not change casually - every flag
# is load-bearing for behavioural identity:
#   --strict-nullable          only anyOf-null fields become Optional
#   --capitalise-enum-members  ExerciseType.MATCHING etc. (app-wide API)
#   --enable-faux-immutability frozen=True (parity with the hand model)
#   --field-constraints        bounds as Field(...) args (hand-model style)
#   --set-default-enum-member  enum defaults as members, not raw strings
#   --target-python-version 3.10  (str, Enum) classes, NOT StrEnum: keeps
#                              str(ExerciseType.MATCHING) behaviour identical
FLAGS = [
    "--output-model-type",
    "pydantic_v2.BaseModel",
    "--target-python-version",
    "3.10",
    "--strict-nullable",
    "--capitalise-enum-members",
    "--enable-faux-immutability",
    "--field-constraints",
    "--set-default-enum-member",
    "--use-subclass-enum",
    "--use-schema-description",
    "--use-field-description",
    "--collapse-root-models",
    "--disable-timestamp",
    "--formatters",
    "black",
]


def _collapse_nullable(node: Any) -> None:
    """Rewrite ``anyOf: [X, {type: null}]`` to inline ``type: [T, "null"]``.

    Pydantic emits optional fields as two-branch anyOf unions; passed
    verbatim, datamodel-code-generator reifies every such branch into a
    named ``RootModel`` wrapper (``Sentence``, ``TokenRoles``, ...) whose
    instances break plain attribute access (``sentence.count`` etc.). The
    type-array form validates identically under JSON Schema and generates
    inline ``X | None`` fields. Enum and $ref branches are left as anyOf -
    they generate proper classes, not wrappers.
    """
    if isinstance(node, dict):
        any_of = node.get("anyOf")
        if (
            isinstance(any_of, list)
            and len(any_of) == 2
            and {"type": "null"} in any_of
        ):
            branch = next(b for b in any_of if b != {"type": "null"})
            # Scalars AND arrays collapse; enum / $ref branches stay anyOf
            # (they generate proper named classes, never wrappers).
            if isinstance(branch.get("type"), str) and "enum" not in branch:
                merged = dict(branch)
                merged["type"] = [branch["type"], "null"]
                for key, value in node.items():
                    if key != "anyOf":
                        merged.setdefault(key, value)
                node.clear()
                node.update(merged)
        for value in list(node.values()):
            _collapse_nullable(value)
    elif isinstance(node, list):
        for value in node:
            _collapse_nullable(value)


_NULLABLE_LIST_FIELD = re.compile(
    r"^(?P<indent>\s+)(?P<name>\w+): (?P<type>list\[[^=\n]+?\])"
    r"(?P<eq> = (?:Field\(\s*\n?\s*None|None))",
    re.MULTILINE,
)


def _fix_nullable_lists(source: str) -> str:
    """Add the missing ``| None`` on nullable list fields.

    datamodel-code-generator renders ``type: ["array", "null"]`` as
    ``x: list[T] = Field(None, ...)`` - the default is None but the
    annotation lacks ``| None``, so an explicit null input (e.g. a
    ``model_dump`` round-trip) fails validation. This is a deterministic
    generator post-step (the same category as the engine's
    ``stripArrayBounds`` in its TS generator), covered by the ``--check``
    drift gate like everything else this script emits.
    """
    return _NULLABLE_LIST_FIELD.sub(
        lambda m: f"{m.group('indent')}{m.group('name')}: {m.group('type')} | None{m.group('eq')}",
        source,
    )


def generate(schema_path: Path, class_name: str) -> str:
    """Run datamodel-codegen for one schema, return the module source."""
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    _collapse_nullable(schema)
    with tempfile.TemporaryDirectory() as tmp:
        prepared = Path(tmp) / "schema.json"
        prepared.write_text(json.dumps(schema), encoding="utf-8")
        out = Path(tmp) / "out.py"
        subprocess.run(
            [
                "datamodel-codegen",
                "--input",
                str(prepared),
                "--input-file-type",
                "jsonschema",
                "--output",
                str(out),
                "--class-name",
                class_name,
                "--custom-file-header",
                HEADER.format(source=schema_path.relative_to(REPO_ROOT)),
                *FLAGS,
            ],
            check=True,
            capture_output=True,
        )
        return _fix_nullable_lists(out.read_text(encoding="utf-8"))


def main() -> int:
    check = "--check" in sys.argv
    drift = False
    for schema_path, module_name, class_name in TARGETS:
        generated = generate(schema_path, class_name)
        target = PACKAGE_DIR / module_name
        current = target.read_text(encoding="utf-8") if target.exists() else ""
        if check:
            if current != generated:
                print(f"DRIFT    {module_name} (run `make sync-schema`)")
                drift = True
            else:
                print(f"OK       {module_name}")
        else:
            target.write_text(generated, encoding="utf-8")
            print(f"Wrote {target.relative_to(REPO_ROOT)}")
    if check and drift:
        return 1
    if check:
        print("Generated Pydantic models are in sync with the schema mirror.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
