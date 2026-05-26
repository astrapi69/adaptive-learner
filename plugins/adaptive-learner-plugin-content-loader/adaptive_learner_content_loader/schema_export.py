"""JSON Schema export for the Content-Loader's data models
(Phase 43 / EXP-002 / 2B — P-103).

Used by:

- External editors / IDE plugins so a content author can
  validate their manifest.yaml + lesson .json files BEFORE
  pushing a PR to the content repo.
- The content repo's CI: a GitHub-Actions workflow runs the
  same JSON Schemas against every file in ``sets/`` on every
  PR.
- The Content-Loader CLI (Phase 44+) for ``adaptive-learner
  content validate <path>`` style commands.

The schemas are derived from Pydantic v2's
``model_json_schema()`` so they stay in lockstep with the
models. The exports never duplicate validation logic; they
are a documentation artefact + a contract for tools outside
the Python codebase.

The export is JSON, NOT JSON-Schema-with-draft-suffix --
Pydantic v2 emits a 2020-12-draft document by default and
that's what we ship. External tooling (ajv, jsonschema,
yajsv) supports the 2020-12 draft.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import ContentManifest, ContentSet


def manifest_schema() -> dict[str, Any]:
    """Return the JSON Schema for ``ContentManifest``."""
    return ContentManifest.model_json_schema()


def set_schema() -> dict[str, Any]:
    """Return the JSON Schema for ``ContentSet``."""
    return ContentSet.model_json_schema()


def write_schemas(out_dir: Path) -> dict[str, Path]:
    """Materialise every schema as a JSON file under ``out_dir``.

    Returns a mapping of schema name → written path so callers
    (CI workflows, release scripts) can verify the file set.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    written: dict[str, Path] = {}
    for name, schema in (
        ("content-manifest.schema.json", manifest_schema()),
        ("content-set.schema.json", set_schema()),
    ):
        target = out_dir / name
        target.write_text(
            json.dumps(schema, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        written[name] = target
    return written
