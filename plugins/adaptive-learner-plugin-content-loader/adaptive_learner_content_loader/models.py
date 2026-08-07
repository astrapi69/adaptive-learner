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

from pydantic import Field, field_validator, model_validator

from .manifest_generated import (
    ContentManifest as ContentManifestBase,
    ContentSet as ContentSetBase,
    ContentSetAsset as ContentSetAssetBase,
    ContentSetBook,
)

CURRENT_SCHEMA_VERSION = "1.9"
# v1.8 -> v1.9 (stable identity + attribution + review status,
# engine 0.16.0 / engine#90, app pin bump #2265):
#   - Additive ``stable_id`` on Exercise and Card: an opaque,
#     author-owned, mint-once identity that never moves when the
#     content text is corrected. Progress/SRS still key on the
#     content-derived element_key; switching that key is a separate
#     decision with its own release condition (#2130), NOT this bump.
#   - Additive ``attribution`` (author + derived_from chain) and
#     ``review_status`` on the manifest set entry.
#   Still a MINOR bump - major-version match means v1.8 readers load
#   v1.9 content (they ignore the new optional fields).
# v1.7 → v1.8 (uploaded picture_choice images, engine 0.13.0 / #1774):
#   - A ``picture_choice`` image reference accepts, besides the
#     ``assets/`` relative path, an inline base64 data URI so an
#     uploaded image can be carried in the lesson itself. Additive,
#     engine-owned; the app is a schema consumer of the pinned engine.
#   Still a MINOR bump — major-version match means v1.7 readers load
#   v1.8 content (they ignore the new optional image format).
# v1.4 → v1.5 (inline examples):
#   - New optional ``InlineExample`` list ``examples`` on BOTH the
#     theory step (``LessonStep``) and the ``Exercise``. An example
#     carries real inline content (a sample sentence, or a syntax-
#     highlighted code snippet when ``language`` is set) — distinct
#     from the ``example_url`` LINK variant added in v1.4. All optional,
#     so pre-v1.5 lessons validate unchanged.
#   Still a MINOR bump — major-version match means older v1.x readers
#   load v1.5 content (they ignore the new optional fields).
# v1.3 → v1.4 (external example link, #139):
#   - ``LessonStep`` gained the optional ``example_url`` + ``example_label``
#     fields (a link button under a THEORY step's content). Additive.
# v1.2 → v1.3 (technical / programming content):
#   - ``Card`` gained optional code fields: ``code_snippet``,
#     ``code_language``, ``expected_output``, ``hint``,
#     ``difficulty`` (1-5), and ``media_type`` ("text" | "code" |
#     "formula" | "diagram"). All optional, so pre-v1.3 lessons
#     validate unchanged.
#   - ``Lesson`` gained an optional ``domain`` mirror of the parent
#     set's domain. Non-language domains (psychology, programming)
#     allow source == target (enforced in the content validator).
#   Still a MINOR bump — major-version match means v1.2 readers load
#   v1.3 content (they just ignore the new optional fields).
# v1.0 → v1.1 (Phase 52D / v1.35.0 / P-127):
#   - ExerciseType gained the CLOZE = "cloze" variant + the
#     ``sentence`` / ``blanks`` / ``cloze_mode`` fields on
#     ``Exercise`` to back it.
#   - Card gained the optional ``token_roles`` field (Phase 52I
#     / P-130) for the cloze generator's role-aware blank
#     selection.
# v1.1 → v1.2 (Phase 60 / v1.44.0):
#   - ``ContentSet`` (and ``Lesson``) gained the language-PAIR
#     fields. The old single ``language`` field is renamed to
#     ``target_language`` (what the learner is LEARNING) and a
#     new ``source_language`` field (what the learner ALREADY
#     SPEAKS) is added. ``language`` stays accepted as a read
#     alias for ``target_language`` so pre-v1.2 content loads
#     unchanged; ``source_language`` defaults to ``"en"`` when
#     a pre-v1.2 manifest omits it (the pilot content was all
#     authored with English explanations). A ``language`` read
#     property keeps existing ``set.language`` call sites green.
# Bump is MINOR — ``is_supported_schema_version`` does a major-
# version match so v1.x lessons still load on older v1.x apps at
# the manifest level. Failure surfaces per-exercise when a 1.0 app
# encounters a ``cloze`` step (closed-enum rejection by
# Pydantic), which is the intended clean break.

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
                f"asset path must end in one of "
                f"{sorted(_IMAGE_EXTENSIONS)}",
            )
        return value




class ContentSet(ContentSetBase):
    """Semantic layer: the legacy ``language`` alias, slug/BCP-47/path/
    semver shapes and slug tags (structure in the generated base).
    ``assets`` is retargeted to the semantic subclass so nested
    validation runs its rules."""

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

    @field_validator("target_language", "source_language")
    @classmethod
    def _bcp47_language(cls, value: str) -> str:
        if not _LANGUAGE_RE.fullmatch(value):
            raise ValueError(
                "language codes must be BCP-47 "
                "(e.g. 'fr', 'de-AT', 'zh-Hans')"
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
