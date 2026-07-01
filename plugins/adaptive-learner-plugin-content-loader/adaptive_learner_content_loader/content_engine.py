"""Content Engine — the source→canonical boundary (EXP-042), backend half.

The **canonical internal format** is the single-JSON lesson object
(``schema.Lesson``, ``schema_version`` 1.4, EXP-039). A **source adapter**
turns raw source data into that canonical object; today exactly one adapter
exists (single-JSON). A future multi-file adapter (``lesson.yaml`` +
``theory.md`` + ``cards.yaml`` + ``exercises.yaml``) plugs in at this same
boundary without touching fetch, cache, or routes.

This module is the named boundary; the field-level parsing/validation lives in
``manifest_parser`` + ``schema`` + ``models`` (kept as the low-level parsers so
their existing tests stay unchanged). Consumers (``cache``, ``service``) call
**this** module, not ``manifest_parser`` directly, so "source → canonical" is a
single, replaceable step.

Lib-extraction seam: this module + ``schema`` + ``models`` + ``manifest_parser``
are the future standalone content-engine library (Input: raw source data +
set context; Output: a validated canonical ``Lesson``). Network
(``github_adapter``), persistence (``cache``), and HTTP (``routes``) stay
outside. The import direction (consumer → engine, never engine → consumer) is
the mechanical proof the seam holds.

The concept names mirror the frontend ``content/engine`` module 1:1
(``content engine``, ``single-json`` source adapter, ``canonical Lesson``) so a
later cross-language parity golden can pin both sides to the same form.
"""

from __future__ import annotations

from collections.abc import Callable

from .manifest_parser import parse_lesson_json, parse_manifest_yaml
from .models import ContentManifest
from .schema import Lesson

#: A source adapter: raw source text → canonical :class:`~.schema.Lesson`.
#: Today the only implementation is :func:`single_json_lesson_adapter`; a
#: multi-file adapter (EXP-042 §6) would satisfy the same signature.
LessonSourceAdapter = Callable[[str], Lesson]


def single_json_lesson_adapter(raw_text: str) -> Lesson:
    """The single-JSON source adapter: raw lesson JSON text → canonical Lesson.

    Delegates to the low-level :func:`~.manifest_parser.parse_lesson_json`,
    which handles ``json.loads`` + Pydantic validation (including referential
    integrity). This is the only place the raw-JSON → canonical transform
    happens on the backend.
    """
    return parse_lesson_json(raw_text)


def parse_lesson(
    raw_text: str,
    adapter: LessonSourceAdapter = single_json_lesson_adapter,
) -> Lesson:
    """Parse raw source data into a canonical Lesson via a source adapter.

    This is the backend content-engine entry point consumed by the cache
    layer. A future multi-file adapter is passed here instead, with no change
    to the caller's fetch/cache.
    """
    return adapter(raw_text)


def parse_manifest(raw_text: str) -> ContentManifest:
    """Parse + validate a raw ``manifest.yaml`` payload into a ContentManifest.

    Delegates to :func:`~.manifest_parser.parse_manifest_yaml` (YAML load +
    schema-version gate + Pydantic validation).
    """
    return parse_manifest_yaml(raw_text)
