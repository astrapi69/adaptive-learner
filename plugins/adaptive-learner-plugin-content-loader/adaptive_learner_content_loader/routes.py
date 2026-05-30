"""FastAPI routes for the Content-Loader plugin
(Phase 43 / EXP-002 / 2C-wire).

  GET   /api/plugins/content-loader/sets                       → list of SetEntry
  POST  /api/plugins/content-loader/sets/{src}/{id}/download   → SetEntry
  GET   /api/plugins/content-loader/sets/{src}/{id}/lessons    → [lesson filenames]
  GET   /api/plugins/content-loader/sets/{src}/{id}/lessons/{filename} → Lesson JSON

``src`` is the source slug ``owner--name`` (slash → ``--``) so
the path stays flat under one ``/sets/{src}/{id}/`` prefix.
The frontend's ApiStorage namespace re-slugifies the original
``owner/name`` before calling these routes.

The routes are THIN: per the architecture rule, they validate
the input + call ``ContentLoaderService``, then return the
result. Domain exceptions raised by the service get caught by
the helper and re-raised as the matching
``AdaptiveLearnerError`` subclass so the global handler maps
them to HTTP status codes consistently with the rest of the
backend.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, model_validator
from pydantic import ValidationError as PydanticValidationError

from app.exceptions import (
    ExternalServiceError,
    NotFoundError,
    ValidationError,
)
from app.paths import get_cache_dir

from . import config_resolver
from .cache import latest_cached_version, read_asset
from .exceptions import (
    ContentAuthError,
    ContentFetchError,
    ContentLoaderError,
    ContentNetworkError,
    ContentNotFoundError,
    ContentSchemaError,
)
from .schema import Lesson
from .service import (
    ContentLoaderService,
    SetEntry,
    parse_source_refs_from_settings,
)


# Phase 54F — MIME types for the asset proxy. The whitelist
# matches the ContentSetAsset path validator's extension
# allowlist 1:1. Anything not in this map gets ``image/*`` or
# ``application/octet-stream`` as a defensive fallback (the
# manifest validator would reject unknown extensions
# upstream, so the fallback is dead code in practice).
_ASSET_MIME_TYPES: dict[str, str] = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
}

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plugins/content-loader", tags=["content-loader"])

CACHE_SUBDIR = "content-loader"


def _build_service() -> ContentLoaderService:
    """Construct a service per request.

    The service is cheap (no DB session, no long-lived
    connections) so per-request instantiation keeps the
    architecture rule "no module-level singletons that touch
    user data" satisfied. The cache root resolves via
    ``get_cache_dir()`` so the test-isolation tripwire fires
    if the request ever lands outside a test sandbox during
    E2E runs.
    """
    settings = config_resolver.read_plugin_settings()
    source_refs = parse_source_refs_from_settings(
        settings.get("default_sources"),
    )
    cache_root = get_cache_dir() / CACHE_SUBDIR
    token = config_resolver.resolve_github_token(settings)
    return ContentLoaderService(
        cache_root=cache_root,
        sources=source_refs,
        token=token,
    )


def _wrap_loader_error(err: ContentLoaderError) -> Exception:
    """Map a plugin-typed error onto the backend hierarchy.

    The global exception handler in ``app/main.py`` reads
    the resulting class to pick the HTTP status code. Auth
    failures surface as ExternalServiceError (502) because
    the failure originated on the upstream, not the user.
    """
    if isinstance(err, ContentNotFoundError):
        return NotFoundError(err.detail)
    if isinstance(err, (ContentAuthError, ContentNetworkError)):
        return ExternalServiceError("github", err.detail)
    if isinstance(err, ContentSchemaError):
        return ValidationError(err.detail)
    if isinstance(err, ContentFetchError):
        return ExternalServiceError("github", err.detail)
    # Generic fallback — surfaces as 500 via the global
    # handler, which is the right shape for "we don't know
    # what went wrong here".
    return err


# --- Response shapes --------------------------------------------------------


class SetEntryResponse(BaseModel):
    """Wire shape for one set in the Set Browser."""

    source: str
    branch: str
    id: str
    title: str
    # ``language`` mirrors ``target_language`` for pre-v1.44.0
    # frontend builds that still read it; new clients use the
    # explicit pair fields.
    language: str
    target_language: str
    source_language: str
    level: str
    domain: str
    version: str
    lesson_count: int
    description: str | None
    tags: list[str]
    cover_image: str | None
    cached_version: str | None
    update_available: bool

    @classmethod
    def from_entry(cls, entry: SetEntry) -> "SetEntryResponse":
        return cls(
            source=entry.source,
            branch=entry.branch,
            id=entry.set.id,
            title=entry.set.title,
            language=entry.set.target_language,
            target_language=entry.set.target_language,
            source_language=entry.set.source_language,
            level=entry.set.level,
            domain=entry.set.domain,
            version=entry.set.version,
            lesson_count=entry.set.lesson_count,
            description=entry.set.description,
            tags=list(entry.set.tags),
            cover_image=entry.set.cover_image,
            cached_version=entry.cached_version,
            update_available=entry.update_available,
        )


class SetsListResponse(BaseModel):
    sets: list[SetEntryResponse]
    sources: list[dict[str, str]]


# --- Helpers ----------------------------------------------------------------


def _unslugify_source(slug: str) -> str:
    return slug.replace("--", "/")


# --- Endpoints --------------------------------------------------------------


@router.get("/sets", response_model=SetsListResponse)
async def list_sets() -> SetsListResponse:
    service = _build_service()
    try:
        entries = await service.list_sets()
    except ContentLoaderError as err:
        raise _wrap_loader_error(err) from err
    return SetsListResponse(
        sets=[SetEntryResponse.from_entry(e) for e in entries],
        sources=[{"source": ref.source, "branch": ref.branch} for ref in service.sources],
    )


@router.post(
    "/sets/{source_slug}/{set_id}/download",
    response_model=SetEntryResponse,
)
async def download_set(
    source_slug: str,
    set_id: str,
) -> SetEntryResponse:
    service = _build_service()
    source = _unslugify_source(source_slug)
    # Find the branch from configured sources; default to
    # 'main' if the source wasn't pre-registered (the user
    # may add a one-off source by URL later).
    branch = next(
        (ref.branch for ref in service.sources if ref.source == source),
        "main",
    )
    try:
        entry = await service.download_set(source, branch, set_id)
    except ContentLoaderError as err:
        raise _wrap_loader_error(err) from err
    return SetEntryResponse.from_entry(entry)


class LessonListResponse(BaseModel):
    set_id: str
    source: str
    version: str | None
    lessons: list[str]


@router.get(
    "/sets/{source_slug}/{set_id}/lessons",
    response_model=LessonListResponse,
)
async def list_set_lessons(
    source_slug: str,
    set_id: str,
) -> LessonListResponse:
    service = _build_service()
    source = _unslugify_source(source_slug)
    filenames = service.list_cached_lesson_filenames(source, set_id)
    if not filenames and not service.has_cached_set(source, set_id):
        raise NotFoundError(
            f"Set {source}/{set_id} is not cached. Download the set before listing its lessons.",
        )
    version_field = None
    try:
        from .cache import latest_cached_version

        version_field = latest_cached_version(
            service.cache_root,
            source,
            set_id,
        )
    except Exception:  # pragma: no cover - defensive
        version_field = None
    return LessonListResponse(
        set_id=set_id,
        source=source,
        version=version_field,
        lessons=filenames,
    )


@router.get(
    "/sets/{source_slug}/{set_id}/lessons/{filename}",
    response_model=Lesson,
)
async def get_lesson(
    source_slug: str,
    set_id: str,
    filename: str,
) -> Lesson:
    service = _build_service()
    source = _unslugify_source(source_slug)
    try:
        return service.get_lesson(source, set_id, filename)
    except ContentLoaderError as err:
        raise _wrap_loader_error(err) from err


def _mime_for_asset(asset_path: str) -> str:
    """Pick a Content-Type from the asset path's extension.
    Defaults to ``application/octet-stream`` for unknown
    extensions (the manifest validator already rejects those
    upstream so this fallback is defensive)."""
    lower = asset_path.lower()
    for ext, mime in _ASSET_MIME_TYPES.items():
        if lower.endswith(ext):
            return mime
    return "application/octet-stream"


@router.get(
    "/sets/{source_slug}/{set_id}/assets/{asset_path:path}",
    responses={
        200: {"content": {"image/*": {}}},
        404: {"description": "Asset not cached"},
    },
)
async def get_asset(
    source_slug: str,
    set_id: str,
    asset_path: str,
) -> Response:
    """Phase 54F / v1.37.0 — serve a cached asset by relative
    path.

    The path-traversal guard lives inside ``cache.read_asset``
    (resolve + startswith check). 404 responses are explicit
    so the frontend resolver can treat them identically to
    DexieStorage's null return — graceful fallback to
    placeholder SVG / text-only.

    ``Cache-Control: public, max-age=31536000, immutable``:
    the cache layout is versioned (``v{version}/assets/...``)
    so an asset URL never changes its bytes within one cycle.
    Browsers can hold onto the response forever; the URL
    itself flips when the set version bumps.
    """
    service = _build_service()
    source = _unslugify_source(source_slug)
    version = latest_cached_version(service.cache_root, source, set_id)
    if version is None:
        raise NotFoundError(
            f"Set {source}/{set_id} is not cached. Download the set first.",
        )
    try:
        payload = read_asset(
            service.cache_root,
            source,
            set_id,
            version,
            asset_path,
        )
    except ContentNotFoundError as err:
        # Map to backend's NotFoundError so the global
        # exception handler returns HTTP 404 with the right
        # detail shape (instead of leaking the plugin-typed
        # error).
        raise NotFoundError(err.detail) from err
    return Response(
        content=payload,
        media_type=_mime_for_asset(asset_path),
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
        },
    )


# --- Phase 59B/C / v1.42.0 — user-generated sets (My Lessons) ---------------


class SaveUserSetRequest(BaseModel):
    """Wire shape for saving a user-generated set. ``lessons`` are
    full, schema-valid lessons (FastAPI validates them as ``Lesson``
    before the handler runs)."""

    set_id: str
    title: str
    target_language: str
    source_language: str = "en"
    level: str
    origin: Literal["analysis", "adaptive", "imported"] = "analysis"
    description: str | None = None
    lessons: list[Lesson]

    @model_validator(mode="before")
    @classmethod
    def _accept_language_alias(cls, data: object) -> object:
        """Map the pre-v1.44.0 ``language`` key to
        ``target_language`` so older frontend builds keep
        working against the new endpoint shape."""
        if isinstance(data, dict) and "language" in data:
            data = dict(data)
            legacy = data.pop("language")
            data.setdefault("target_language", legacy)
        return data


@router.post("/user-sets", response_model=SetEntryResponse)
async def save_user_set(body: SaveUserSetRequest) -> SetEntryResponse:
    """Persist a user-generated set into the cache (same place as
    downloaded sets, ``source: "user-generated"``)."""
    service = _build_service()
    try:
        entry = service.save_user_set(
            set_id=body.set_id,
            title=body.title,
            target_language=body.target_language,
            source_language=body.source_language,
            level=body.level,
            origin=body.origin,
            lessons=body.lessons,
            description=body.description,
        )
    except PydanticValidationError as err:
        # ContentSet/ContentManifest construction rejected the input
        # (e.g. non-slug set_id, non-BCP47 language). Surface as 400.
        raise ValidationError(f"Invalid user set: {err}") from err
    except ContentLoaderError as err:
        raise _wrap_loader_error(err) from err
    return SetEntryResponse.from_entry(entry)


@router.delete("/sets/{source_slug}/{set_id}", status_code=204)
async def delete_set(source_slug: str, set_id: str) -> Response:
    """Delete a cached set (used by My Lessons). Idempotent."""
    service = _build_service()
    source = _unslugify_source(source_slug)
    service.delete_set(source, set_id)
    return Response(status_code=204)
