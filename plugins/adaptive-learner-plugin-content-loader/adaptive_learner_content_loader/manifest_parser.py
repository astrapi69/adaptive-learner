"""Manifest + lesson parser (Phase 43 / EXP-002 / 2C-cache — P-104).

Two top-level parsers:

- ``parse_manifest_yaml(text)`` → ``ContentManifest`` —
  used after fetching ``manifest.yaml`` from a content repo.
  Runs the schema-version compatibility check BEFORE
  Pydantic so a v2.x manifest gets a friendly upgrade
  message instead of a confusing pile of validation errors
  on the new fields.

- ``parse_lesson_json(text)`` → ``Lesson`` —
  used after fetching ``lessons/{id}.json`` from a set.
  Pure Pydantic validation; all the referential-integrity
  checks live on the model.

Both raise ``ContentSchemaError`` on validation failure with
a human-readable detail message so the Settings UI can show
the content author exactly what went wrong.
"""

from __future__ import annotations

import json
from typing import Any

import yaml
from pydantic import ValidationError

from .exceptions import ContentSchemaError
from .models import (
    CURRENT_SCHEMA_VERSION,
    ContentManifest,
    is_supported_schema_version,
)
from .schema import Lesson


def parse_manifest_yaml(text: str) -> ContentManifest:
    """Parse + validate a manifest.yaml payload.

    Steps:
    1. Parse YAML. Surface a clear error if the bytes aren't
       a YAML document at all.
    2. Reject non-mapping documents.
    3. Check ``schema_version`` is in the v1.x range BEFORE
       Pydantic runs (so future v2.x users see a friendly
       'please upgrade the app' message instead of a wall of
       unknown-field errors).
    4. Hand off to Pydantic for the full schema validation.
    """
    try:
        raw: Any = yaml.safe_load(text)
    except yaml.YAMLError as err:
        raise ContentSchemaError(
            "Manifest YAML is malformed.",
            detail=str(err),
        ) from err

    if not isinstance(raw, dict):
        raise ContentSchemaError(
            "Manifest must be a YAML mapping at the top level.",
            detail=f"Got a {type(raw).__name__} instead.",
        )

    # Pre-Pydantic schema-version gate. The
    # ``schema_version`` field defaults to the current
    # version (1.0) when omitted, so an absent field is
    # NOT an error here — it just inherits the default.
    declared = raw.get("schema_version", CURRENT_SCHEMA_VERSION)
    if not isinstance(declared, str):
        raise ContentSchemaError(
            "Manifest schema_version must be a string.",
            detail=f"Got {type(declared).__name__}: {declared!r}",
        )
    if not is_supported_schema_version(declared):
        raise ContentSchemaError(
            (
                f"Manifest schema_version {declared!r} is not "
                f"supported by this Content-Loader (handles "
                f"{CURRENT_SCHEMA_VERSION}.x). Please upgrade "
                "Adaptive Learner to read this manifest."
            ),
            detail=(
                f"Upstream declared schema_version={declared}; "
                f"loader supports {CURRENT_SCHEMA_VERSION}.x"
            ),
        )

    try:
        return ContentManifest.model_validate(raw)
    except ValidationError as err:
        raise ContentSchemaError(
            "Manifest failed schema validation.",
            detail=str(err),
        ) from err


def parse_lesson_json(text: str) -> Lesson:
    """Parse + validate a lesson .json payload.

    Lesson files do NOT carry a schema_version (the manifest
    is the schema-versioning anchor for a whole set). The
    parser raises ``ContentSchemaError`` on any Pydantic
    failure, including the referential-integrity model
    validator (which catches exercises referencing
    undefined cards).
    """
    try:
        raw = json.loads(text)
    except json.JSONDecodeError as err:
        raise ContentSchemaError(
            "Lesson JSON is malformed.",
            detail=str(err),
        ) from err

    if not isinstance(raw, dict):
        raise ContentSchemaError(
            "Lesson must be a JSON object at the top level.",
            detail=f"Got a {type(raw).__name__} instead.",
        )

    try:
        return Lesson.model_validate(raw)
    except ValidationError as err:
        raise ContentSchemaError(
            "Lesson failed schema validation.",
            detail=str(err),
        ) from err
