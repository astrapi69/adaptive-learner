"""Pydantic v2 models for Content-Loader (Phase 43 / EXP-002 / 2B).

The Content-Loader maintains two top-level data shapes:

- ``ContentManifest``: published by a content repo at its
  root. Catalogues every set the repo ships. Versioned via
  ``schema_version`` so a future bump can be detected and
  rejected. Read by the GitHub adapter on first fetch and on
  every cache-refresh interval.

- ``ContentSet``: one downloadable unit inside the manifest.
  Describes language + level + version + size. The user
  browses sets in the Set Browser page (commit 7); the
  download endpoint fetches every file the set references.

The lesson schema lives in ``schema.py`` (next commit). The
``ContentSet.lesson_count`` field is the only cross-reference
here — it's authoritative metadata, not derived from the
lesson files (so the manifest can be browsed without
downloading every set).

Domain field on ``ContentSet`` is a free string ('language',
'math', 'programming', ...). EXP-005 introduces a
domain-plugin interface in a later phase; right now the
loader treats domain as opaque metadata and does not enforce
a closed enum.

All language codes follow BCP 47 (e.g. ``fr``, ``de-AT``).
Level follows the CEFR convention for languages (``A1`` ..
``C2``) but the field is a plain string so non-language
domains can use their own scale ('beginner', 'intermediate',
or '01'..'10' for math).
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

CURRENT_SCHEMA_VERSION = "1.0"

# BCP-47 subset: lowercase 2-3 letter primary tag plus an
# optional ``-`` separator + region/script tag. Permissive
# enough for ``fr``, ``de-AT``, ``zh-Hans``; strict enough to
# reject obviously broken values like ``francais`` or ``en_US``.
_LANGUAGE_RE = re.compile(r"^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$")

# Semver-style major.minor.patch with optional ``-pre`` /
# ``+meta`` suffix. Loose by design — content authors should
# be able to ship `1.0.0`, `1.0`, or `1.0.0-rc1` without
# wrestling the validator.
_VERSION_RE = re.compile(
    r"^\d+(\.\d+){1,2}([\-+][A-Za-z0-9.\-]+)?$"
)

# Slug-safe identifier: lowercase letters, digits, hyphens.
# Used for both set_id and source identifiers.
_SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


class ContentSet(BaseModel):
    """One downloadable lesson set inside a ContentManifest.

    A set is the unit of versioning: re-publishing a single
    lesson bumps the set's ``version`` and triggers a
    re-download (see the cache layer in commit 5).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(
        ...,
        description=(
            "Slug-safe identifier, unique within the manifest. "
            "Convention: ``{domain}-{language}-{level}`` for "
            "language sets (e.g. ``language-fr-a1``). The "
            "loader does NOT parse this — it's free-form per "
            "the EXP-005 domain-agnostic stance."
        ),
        min_length=1,
        max_length=120,
    )
    title: str = Field(
        ...,
        description="Human-readable title shown in the Set Browser.",
        min_length=1,
        max_length=200,
    )
    language: str = Field(
        ...,
        description=(
            "BCP-47 language code of the set's CONTENT (not "
            "the UI). The UI language stays under user "
            "control via the existing i18n system."
        ),
    )
    level: str = Field(
        ...,
        description=(
            "Difficulty / proficiency marker. CEFR (A1..C2) "
            "for languages, free-form for other domains."
        ),
        min_length=1,
        max_length=20,
    )
    version: str = Field(
        ...,
        description=(
            "Semver-style version. Bumped whenever ANY lesson "
            "or asset inside the set changes; drives "
            "cache invalidation."
        ),
    )
    lesson_count: int = Field(
        ...,
        description="Number of lessons the set ships.",
        ge=0,
        le=10000,
    )
    domain: str = Field(
        default="language",
        description=(
            "Free-form domain tag ('language', 'math', "
            "'programming', ...). Reserved for the EXP-005 "
            "domain-plugin interface; the loader treats it "
            "as opaque metadata."
        ),
        min_length=1,
        max_length=60,
    )
    description: str | None = Field(
        default=None,
        description="Optional long-form description.",
        max_length=2000,
    )
    cover_image: str | None = Field(
        default=None,
        description=(
            "Optional relative path inside the set "
            "('assets/cover.png'). Resolved against the set's "
            "base URL by the GitHub adapter."
        ),
    )
    tags: list[str] = Field(
        default_factory=list,
        description=(
            "Free-form tags ('beginner', 'travel', 'business'). "
            "Surfaced in the Set Browser as filter chips."
        ),
        max_length=20,
    )

    @field_validator("id")
    @classmethod
    def _slug_id(cls, value: str) -> str:
        if not _SLUG_RE.fullmatch(value):
            raise ValueError(
                "id must be slug-safe "
                "(lowercase letters / digits / hyphens, "
                "no leading/trailing hyphen)"
            )
        return value

    @field_validator("language")
    @classmethod
    def _bcp47_language(cls, value: str) -> str:
        if not _LANGUAGE_RE.fullmatch(value):
            raise ValueError(
                "language must be a BCP-47 code "
                "(e.g. 'fr', 'de-AT', 'zh-Hans')"
            )
        return value

    @field_validator("version")
    @classmethod
    def _semver_version(cls, value: str) -> str:
        if not _VERSION_RE.fullmatch(value):
            raise ValueError(
                "version must be semver-shaped "
                "(e.g. '1.0.0', '1.2', '2.0.0-rc1')"
            )
        return value

    @field_validator("tags")
    @classmethod
    def _slug_tags(cls, value: list[str]) -> list[str]:
        for tag in value:
            if not _SLUG_RE.fullmatch(tag):
                raise ValueError(
                    f"tag '{tag}' must be slug-safe "
                    "(lowercase letters / digits / hyphens)"
                )
        return value


class ContentManifest(BaseModel):
    """Top-level manifest a content repo publishes at its root.

    A repo CAN ship multiple sets in one manifest (the canonical
    pilot ``astrapi69/adaptive-learner-content`` is structured
    that way). The manifest itself is small (~one entry per
    set) so the Set Browser can list everything without
    downloading any lesson content.

    ``schema_version`` is the LOADER's contract, not the
    content authors' choice. A future bump (e.g. v1.1
    introducing a new mandatory field on ``ContentSet``)
    means older app versions reject the manifest with a
    'please upgrade' message rather than silently miss the
    new field.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    schema_version: str = Field(
        default=CURRENT_SCHEMA_VERSION,
        description=(
            "Manifest schema version. The Content-Loader "
            "currently understands '1.0'; later versions "
            "will be rejected with a friendly upgrade hint."
        ),
    )
    name: str = Field(
        ...,
        description="Human-readable repo name shown in the Set Browser.",
        min_length=1,
        max_length=200,
    )
    description: str | None = Field(
        default=None,
        description="Optional long-form repo description.",
        max_length=2000,
    )
    sets: list[ContentSet] = Field(
        default_factory=list,
        description="Every downloadable set this repo publishes.",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Free-form repo-level metadata (license, author, "
            "homepage URL, contact). The loader does not "
            "interpret these fields — they surface as-is in "
            "the Set Browser's 'About this source' panel."
        ),
    )

    @field_validator("schema_version")
    @classmethod
    def _semver_schema(cls, value: str) -> str:
        if not _VERSION_RE.fullmatch(value):
            raise ValueError(
                "schema_version must be semver-shaped"
            )
        return value

    @field_validator("sets")
    @classmethod
    def _unique_set_ids(cls, value: list[ContentSet]) -> list[ContentSet]:
        seen: set[str] = set()
        for s in value:
            if s.id in seen:
                raise ValueError(
                    f"duplicate set id '{s.id}' in manifest"
                )
            seen.add(s.id)
        return value


def is_supported_schema_version(version: str) -> bool:
    """Return True iff the loader understands this manifest schema.

    The check is intentionally a major-version match: anything
    under ``1.x`` is forward-compatible, ``2.x`` would require
    an explicit loader upgrade. Used by the manifest parser
    (commit 5) to surface a friendly 'please upgrade the app'
    message instead of crashing with a Pydantic validation
    error on the new fields.
    """
    if not _VERSION_RE.fullmatch(version):
        return False
    return version.split(".", 1)[0] == CURRENT_SCHEMA_VERSION.split(".", 1)[0]
