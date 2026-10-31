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

All language codes follow BCP 47 (e.g. ``fr``, ``de-AT``); the
engine's E-LANG-TAG rule checks the shape at authoring time, the
backend stores the value as given (#3245).
Level follows the CEFR convention for languages (``A1`` ..
``C2``) but the field is a plain string so non-language
domains can use their own scale ('beginner', 'intermediate',
or '01'..'10' for math).
"""

from __future__ import annotations

import logging
import re
from typing import Any

from pydantic import Field, field_validator, model_validator

from .manifest_generated import (
    ContentManifest as ContentManifestBase,
)
from .manifest_generated import (
    ContentSet as ContentSetBase,
)
from .manifest_generated import (
    ContentSetAsset as ContentSetAssetBase,
)
from .manifest_generated import (
    ContentSetBook as ContentSetBook,
)

logger = logging.getLogger(__name__)

# #3711 - the values the engine's projection (``asContentSetEntry``) keeps;
# anything else falls back the way it does there.
_KNOWN_VISIBILITY = frozenset({"visible", "hidden"})
_KNOWN_REVIEW_STATUS = frozenset({"authored", "generated", "reviewed"})

#: The manifest ``schema_version`` a writer declares and the major this loader
#: reads: the default of the model generated from the engine mirror
#: ``schema/content-manifest.schema.json`` (#3835), not a literal. It is not the
#: lesson ``x-schema-version``; the two are independent counters (engine docs,
#: "schema_version vs x-schema-version"), and the lesson format's history lives
#: in the engine's changelog.
MANIFEST_SCHEMA_VERSION: str = ContentManifestBase.model_fields["schema_version"].default
#: Manifests of this major load; another major is rejected with an upgrade hint.
SUPPORTED_SCHEMA_MAJOR: str = MANIFEST_SCHEMA_VERSION.split(".", 1)[0]

# Semver-style major.minor.patch with optional ``-pre`` /
# ``+meta`` suffix. Loose by design — content authors should
# be able to ship `1.0.0`, `1.0`, or `1.0.0-rc1` without
# wrestling the validator.
_VERSION_RE = re.compile(r"^\d+(\.\d+){1,2}([\-+][A-Za-z0-9.\-]+)?$")

# Slug-safe identifier: lowercase letters, digits, hyphens.
# Used for source identifiers.
_SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# A set id becomes one directory name in the download cache. Its shape is
# the engine schema's call (#3391: no pattern on a set id, so Unicode
# letters and underscores pass there and in Dexie mode); the app only
# refuses what would not be a single, safe path segment.
_UNSAFE_SEGMENT_RE = re.compile(r"[/\\\x00-\x1f\x7f]")

# Repo-relative directory for a set's files (Phase 60 / v1.44.0).
# Slug-safe segments joined by ``/`` (e.g. ``sets/de/fr-a1``). No
# leading/trailing slash, no ``..`` — the loader appends lesson /
# asset paths to this so any traversal would escape the set.
_SET_DIR_RE = re.compile(
    r"^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$",
)

# Asset path: a relative path inside the set's ``assets/``
# subdirectory. No leading slash, no ``..``, only forward
# slashes, lowercase letters / digits / hyphens / underscores
# / dots as path segments. The path-traversal check is
# strict — the loader appends this to a Path() so any
# upward navigation would break the cache-isolation
# invariant.
_ASSET_PATH_RE = re.compile(
    r"^(?!/)(?!.*\.\.(?:/|$))[A-Za-z0-9_.\-]+(/[A-Za-z0-9_.\-]+)*$",
)

# Accepted image extensions for Phase 54. The frontend's
# ``<img>`` element renders all of these natively; ``.gif`` /
# ``.bmp`` are deliberately excluded (poor compression +
# accessibility for animated GIFs).
_IMAGE_EXTENSIONS = frozenset({".png", ".jpg", ".jpeg", ".webp", ".svg"})

# Per-asset hard limit. Manifest validator rejects assets
# whose declared ``size_kb`` exceeds this; matches the
# v1.37.0 content-authoring guidance. 500 KiB covers any
# reasonable PNG / WebP for a learning-exercise tile.
MAX_ASSET_SIZE_KB = 500

# Per-set soft limit (Phase 54G / v1.37.0). The set-level
# validator warns above this threshold but doesn't reject —
# content authors get a clear signal to revisit their
# compression without blocking publication. 10 MiB covers a
# generous 20-50 tiles depending on format.
SET_ASSETS_SOFT_LIMIT_KB = 10 * 1024  # 10 MiB


class ContentSetAsset(ContentSetAssetBase):
    """Semantic layer: safe asset path + image extension + size limit
    (structure in the generated base)."""

    @field_validator("path")
    @classmethod
    def _valid_path(cls, value: str) -> str:
        if not _ASSET_PATH_RE.fullmatch(value):
            raise ValueError(
                "path must be a relative slug-safe path "
                "(no leading slash, no '..' segments, "
                "only letters / digits / hyphens / underscores / dots)",
            )
        # Image-extension whitelist for the v1.37.0 cut.
        # Audio is allowed (.mp3 / .wav / .ogg) when the
        # audio-asset story lands; the next-phase whitelist
        # bump will be a one-line change.
        suffix = value.rsplit(".", 1)[-1].lower()
        if "." not in value or f".{suffix}" not in _IMAGE_EXTENSIONS:
            raise ValueError(
                f"asset path must end in one of {sorted(_IMAGE_EXTENSIONS)}",
            )
        return value


class ContentSet(ContentSetBase):
    """What the backend needs on top of the generated structure: the
    legacy ``language`` alias, a slug ``id`` and a slug-safe ``path``
    (both are cache directories), and a semver ``version`` (compared
    and sorted by the loader). ``assets`` is retargeted to the semantic
    subclass so nested validation runs its rules. Language-tag and tag
    shapes are the engine's authoring rules, not checked here (#3245).
    """

    assets: list[ContentSetAsset] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _accept_language_alias(cls, data: Any) -> Any:
        """Accept the pre-v1.2 ``language`` key as an alias for
        ``target_language`` so old manifests load unchanged.

        Runs before field validation (and before the
        ``extra="forbid"`` check), so the legacy ``language``
        key is mapped/dropped instead of rejected as extra. When
        both keys are present, ``target_language`` wins and the
        alias is discarded.
        """
        if isinstance(data, dict) and "language" in data:
            data = dict(data)
            legacy = data.pop("language")
            data.setdefault("target_language", legacy)
        return data

    @model_validator(mode="before")
    @classmethod
    def _project_like_the_engine(cls, data: Any) -> Any:
        """Read a set entry the way the engine's projection does (#3711).

        Browser mode projects every entry through ``asContentSetEntry``;
        this loader used to reject the whole manifest where the engine
        falls back, so the two modes listed different sets for one repo:
        a set without a target language (engine: ``""``), and a
        ``visibility`` or ``review_status`` value this version does not
        know (engine: ``visible`` / ``authored``). The last two are the
        forward-compatibility case: a newer engine adds a value and this
        loader must not lose the repo over it. Each fallback is logged.
        """
        if not isinstance(data, dict):
            return data
        data = dict(data)
        set_id = data.get("id")
        # Independent of validator order: the legacy alias counts as declared.
        if "target_language" not in data and "language" not in data:
            logger.warning("set %r declares no target_language; projected as ''", set_id)
            data["target_language"] = ""
        visibility = data.get("visibility")
        if visibility is not None and visibility not in _KNOWN_VISIBILITY:
            logger.warning("set %r: unknown visibility %r read as 'visible'", set_id, visibility)
            data["visibility"] = "visible"
        review_status = data.get("review_status")
        if review_status is not None and review_status not in _KNOWN_REVIEW_STATUS:
            logger.warning(
                "set %r: unknown review_status %r read as 'authored'", set_id, review_status
            )
            data["review_status"] = None
        return data

    @field_validator("id")
    @classmethod
    def _safe_segment_id(cls, value: str) -> str:
        if value in ("", ".", "..") or _UNSAFE_SEGMENT_RE.search(value):
            raise ValueError(
                "id must be a single safe path segment "
                "(not empty, '.' or '..'; no slash, backslash or control character)"
            )
        return value

    @field_validator("path")
    @classmethod
    def _safe_path(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not _SET_DIR_RE.fullmatch(value):
            raise ValueError(
                "path must be a relative slug-safe directory "
                "(no leading/trailing slash, no '..' segments)"
            )
        return value

    @field_validator("version")
    @classmethod
    def _semver_version(cls, value: str) -> str:
        if not _VERSION_RE.fullmatch(value):
            raise ValueError("version must be semver-shaped (e.g. '1.0.0', '1.2', '2.0.0-rc1')")
        return value

    @property
    def language(self) -> str:
        """Backward-compat read alias for ``target_language``.

        Pre-v1.2 code (and any consumer still reading
        ``set.language``) keeps working — the canonical field is
        ``target_language`` but this returns the same value.
        Not a serialised field; ``model_dump`` emits
        ``target_language`` / ``source_language`` only.
        """
        return self.target_language

    @property
    def base_path(self) -> str:
        """Repo-relative directory holding this set's files.

        Returns the explicit ``path`` when declared (the
        source-language tree, e.g. ``sets/de/fr-a1``), else the
        legacy ``sets/{id}`` convention. The loader joins
        ``manifest.yaml`` / ``lessons/{file}`` / ``assets/{path}``
        onto this.
        """
        return self.path or f"sets/{self.id}"

    def assets_total_kb(self) -> int:
        """Sum of declared ``size_kb`` across every bundled
        asset (Phase 54G / v1.37.0). Used by the set-level
        soft-limit warning + the content-authoring docs."""
        return sum(asset.size_kb for asset in self.assets)


def check_set_assets_size(
    content_set: ContentSet,
    soft_limit_kb: int = SET_ASSETS_SOFT_LIMIT_KB,
) -> list[str]:
    """Return zero-or-more advisory warnings for a set's
    asset footprint (Phase 54G / v1.37.0).

    Does NOT raise — the manifest still validates with a
    warning. Downloaders + content-authoring CI hook
    surface the list to the operator (or the author).

    Warning categories (current set):
      - per-asset cap: enforced by the field validator
        (reject), so this helper doesn't repeat it
      - per-set soft cap: ``assets_total_kb >
        soft_limit_kb`` adds one entry
      - asset-count sanity: ``len(assets) > 100`` adds one
        entry (a learning set with 100+ images is almost
        certainly wrong; the validator stays quiet about
        the hard ``max_length=500`` but a soft check at
        100 catches typos like "100 copies of cat.png"
        early)
    """
    warnings: list[str] = []
    total = content_set.assets_total_kb()
    if total > soft_limit_kb:
        warnings.append(
            (
                f"Set {content_set.id!r} declares "
                f"{total} KiB of assets, above the "
                f"{soft_limit_kb} KiB soft limit. "
                "Consider WebP for photos / SVG for icons "
                "to compress further."
            ),
        )
    if len(content_set.assets) > 100:
        warnings.append(
            (
                f"Set {content_set.id!r} declares "
                f"{len(content_set.assets)} assets - "
                "100+ is unusual for a learning set. "
                "Double-check for duplicate manifest entries."
            ),
        )
    return warnings


class ContentManifest(ContentManifestBase):
    """Semantic layer: semver-shaped ``schema_version`` + unique set ids
    (structure in the generated base). ``sets`` is retargeted to the
    semantic subclass so nested validation runs its rules."""

    sets: list[ContentSet] = Field(default_factory=list)

    @field_validator("schema_version")
    @classmethod
    def _semver_schema(cls, value: str) -> str:
        if not _VERSION_RE.fullmatch(value):
            raise ValueError("schema_version must be semver-shaped")
        return value

    @field_validator("sets")
    @classmethod
    def _unique_set_ids(cls, value: list[ContentSet]) -> list[ContentSet]:
        seen: set[str] = set()
        for s in value:
            if s.id in seen:
                raise ValueError(f"duplicate set id '{s.id}' in manifest")
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
    return version.split(".", 1)[0] == SUPPORTED_SCHEMA_MAJOR
