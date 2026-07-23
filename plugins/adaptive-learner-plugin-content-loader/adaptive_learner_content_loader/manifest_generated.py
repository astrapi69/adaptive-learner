# GENERATED from schema/content-manifest.schema.json via scripts/generate_pydantic_models.py
# (D3b, #1528). DO NOT EDIT.
#
# Structural layer only - the semantic cross-field validators live in
# the hand-written subclasses (schema.py / models.py). Regenerate via
# `make sync-schema` after an engine re-pin refreshed the mirror.

from __future__ import annotations

from enum import Enum
from pydantic import BaseModel, ConfigDict, Field
from typing import Any


class Visibility(str, Enum):
    """
    #83 - consumer-display hint. ``hidden`` asks a consumer app NOT to surface the set to learners (e.g. a conformance/reference fixture that must stay on disk for engine validation but is not learner content). Additive and optional; absent means ``visible``. DISPLAY hint only: the engine and ``scripts/conformance-real.mjs`` still validate hidden sets and never exclude them from engine validation; only consumer apps filter on it.
    """

    VISIBLE = 'visible'
    HIDDEN = 'hidden'


class ContentSetAsset(BaseModel):
    """
    One bundled binary asset (image, audio) declared in the
    set manifest (Phase 54 / v1.37.0).

    The declaration drives:
      - the downloader (fetch_asset per ``path`` alongside the
        lesson JSON)
      - the cache writer (store under ``assets/{path}``)
      - the size validator (reject ``size_kb > MAX_ASSET_SIZE_KB``)

    Optional everywhere — sets without any assets simply
    omit the ``assets`` list. The current PictureChoice
    component falls back to text-only when the resolver
    can't produce a blob URL, so authored content without
    assets stays playable.
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    path: str = Field(..., max_length=300, min_length=1, title='Path')
    """
    Relative path inside the set's ``assets/`` directory. Example: ``img/sunrise.png`` resolves to ``{cache_root}/.../assets/img/sunrise.png``. No leading slash, no ``..`` segments — the path is appended to a Path() and any upward navigation would escape the cache isolation.
    """
    size_kb: int = Field(..., ge=1, le=500, title='Size Kb')
    """
    Declared file size in KiB (used by the validator + the downloader's progress reporting). The downloader rejects assets whose actual byte length exceeds ``size_kb * 1024`` by more than 10 percent — keeps content authors honest.
    """


class ContentSetBook(BaseModel):
    """
    #769 — optional set-level book block (manifest ``sets[].book``).

    Surfaced to the lesson's "Vertiefe das Thema" section as the first
    media item. ``extra="ignore"`` tolerates future fields (e.g. ``isbn``,
    ``year``) the media card doesn't consume.
    """

    model_config = ConfigDict(
        frozen=True,
    )
    asin: str | None = Field(None, max_length=20, title='Asin')
    author: str | None = Field(None, max_length=300, title='Author')
    title: str = Field(..., max_length=300, min_length=1, title='Title')
    url: str | None = Field(None, max_length=2000, title='Url')


class ContentSet(BaseModel):
    """
    One downloadable lesson set inside a ContentManifest.

    A set is the unit of versioning: re-publishing a single
    lesson bumps the set's ``version`` and triggers a
    re-download (see the cache layer in commit 5).
    """

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    assets: list[ContentSetAsset] = Field(
        [], max_length=500, title='Assets', validate_default=True
    )
    """
    Phase 54 / v1.37.0 — optional list of binary assets (images, audio) the set bundles. Each entry declares a relative path inside ``assets/`` and the expected size in KiB. The downloader fetches every declared asset alongside the lesson JSON; the cache stores them under ``{cache_root}/.../v{version}/assets/{path}``. The manifest validator rejects assets exceeding the per-file size limit (default 500 KiB).
    """
    book: ContentSetBook | None = None
    """
    #769 — optional set-level book block (title/author/url/asin). When present, the lesson's 'Vertiefe das Thema' section auto-inserts it as the first media item.
    """
    cover_image: str | None = Field(None, title='Cover Image')
    """
    Optional relative path inside the set ('assets/cover.png'). Resolved against the set's base URL by the GitHub adapter.
    """
    description: str | None = Field(None, max_length=2000, title='Description')
    """
    Optional long-form description.
    """
    domain: str = Field('language', max_length=60, min_length=1, title='Domain')
    """
    Free-form domain tag ('language', 'math', 'programming', ...). Reserved for the EXP-005 domain-plugin interface; the loader treats it as opaque metadata.
    """
    domain_label: str | None = Field(None, max_length=120, title='Domain Label')
    """
    Optional human-readable label for the domain shown in the Set Browser (e.g. 'Psychologie' for domain='psychology'). Additive, authored in the content repo; the loader treats it as opaque display metadata.
    """
    id: str = Field(..., max_length=120, min_length=1, title='Id')
    """
    Slug-safe identifier, unique within the manifest. Convention (Phase 60 / v1.44.0): ``{target}-{level}-from-{source}`` for language sets (e.g. ``fr-a1-from-de``). Pre-v1.2 ids like ``language-fr-a1`` still load — the loader does NOT parse this, it's free-form per the EXP-005 domain-agnostic stance.
    """
    lesson_count: int = Field(..., ge=0, le=10000, title='Lesson Count')
    """
    Number of lessons the set ships.
    """
    level: str = Field(..., max_length=20, min_length=1, title='Level')
    """
    Difficulty / proficiency marker. CEFR (A1..C2) for languages, free-form for other domains.
    """
    path: str | None = Field(None, max_length=300, title='Path')
    """
    Phase 60 / v1.44.0 — repo-relative directory where the set's own ``manifest.yaml`` + ``lessons/`` + ``assets/`` live. Enables the source-language tree (e.g. ``sets/de/fr-a1`` for a French-for-German set while the id stays the flat slug ``fr-a1-from-de``). When omitted the loader falls back to the legacy ``sets/{id}`` convention. No leading/trailing slash, no ``..`` segments.
    """
    source_language: str = Field('en', title='Source Language')
    """
    BCP-47 code of the language the learner ALREADY SPEAKS — the language the card ``back`` fields, notes and theory text are written in. A 'French A1 for German speakers' set has ``target_language: fr`` + ``source_language: de``. Defaults to ``en`` for pre-v1.2 content (the pilot sets were authored with English explanations).
    """
    tags: list[str] = Field([], max_length=20, title='Tags')
    """
    Free-form tags ('beginner', 'travel', 'business'). Surfaced in the Set Browser as filter chips.
    """
    target_language: str = Field(..., title='Target Language')
    """
    BCP-47 code of the language the learner is LEARNING (the set's CONTENT language). Renamed from ``language`` in v1.2; the old key is still accepted as a read alias. The UI language stays under user control via the existing i18n system.
    """
    title: str = Field(..., max_length=200, min_length=1, title='Title')
    """
    Human-readable title shown in the Set Browser, in the learner's SOURCE language (e.g. 'Französisch A1 für Deutschsprachige' for a fr-from-de set).
    """
    title_native: str | None = Field(None, max_length=200, title='Title Native')
    """
    Phase 60 / v1.44.0 — optional title in the TARGET language (e.g. 'Français A1' for a French set). Shown as a secondary native-script label alongside ``title``. The community-share validator requires it for shareable sets; bundled/legacy sets may omit it.
    """
    version: str = Field(..., title='Version')
    """
    Semver-style version. Bumped whenever ANY lesson or asset inside the set changes; drives cache invalidation.
    """
    visibility: Visibility = Field(Visibility.VISIBLE, title='Visibility')
    """
    #83 - consumer-display hint. ``hidden`` asks a consumer app NOT to surface the set to learners (e.g. a conformance/reference fixture that must stay on disk for engine validation but is not learner content). Additive and optional; absent means ``visible``. DISPLAY hint only: the engine and ``scripts/conformance-real.mjs`` still validate hidden sets and never exclude them from engine validation; only consumer apps filter on it.
    """


class ContentManifest(BaseModel):
    """
    Top-level manifest a content repo publishes at its root.

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

    model_config = ConfigDict(
        extra='forbid',
        frozen=True,
    )
    description: str | None = Field(None, max_length=2000, title='Description')
    """
    Optional long-form repo description.
    """
    metadata: dict[str, Any] = Field({}, title='Metadata')
    """
    Free-form repo-level metadata (license, author, homepage URL, contact). The loader does not interpret these fields — they surface as-is in the Set Browser's 'About this source' panel.
    """
    name: str = Field(..., max_length=200, min_length=1, title='Name')
    """
    Human-readable repo name shown in the Set Browser.
    """
    schema_version: str = Field('1.6', title='Schema Version')
    """
    Manifest schema version. The Content-Loader currently understands '1.0'; later versions will be rejected with a friendly upgrade hint.
    """
    sets: list[ContentSet] = Field([], title='Sets', validate_default=True)
    """
    Every downloadable set this repo publishes.
    """
