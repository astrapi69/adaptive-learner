"""Orchestrator that composes the GitHub adapter + cache layer
(Phase 43 / EXP-002 / 2C-wire).

The route layer (commit 6) thin-shells over this service.
Tests run against this module directly; the routes get a
TestClient round-trip pin for the HTTP shape.

This is the only module in the plugin that knows about both
the upstream (GitHub adapter) and the local cache. Everything
below it is single-purpose; everything above (routes,
storage namespace) is thin glue.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import httpx

from .cache import (
    cache_path_for_set,
    cleanup_tmp_dirs,
    is_set_cached,
    latest_cached_version,
    list_cached_versions,
    read_lesson,
    read_manifest,
    reconcile_set_version,
    slugify_source,
    store_set,
)
from .exceptions import (
    ContentLoaderError,
    ContentNotFoundError,
    ContentSchemaError,
)
from .github_adapter import GitHubRawAdapter
from .manifest_parser import parse_manifest_yaml
from .models import ContentManifest, ContentSet
from .schema import Lesson

logger = logging.getLogger(__name__)

MANIFEST_FILENAME = "manifest.yaml"


@dataclass(frozen=True)
class SourceRef:
    """A pointer to an upstream content repo.

    The plugin settings (``backend/config/plugins/content-loader.yaml``)
    publish a list of these; the orchestrator iterates them.
    """

    source: str  # GitHub owner/name slug
    branch: str = "main"

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.source}@{self.branch}"


@dataclass(frozen=True)
class SetEntry:
    """One row in the Set Browser.

    Merges upstream + cache state so the UI can render the
    correct download / update / open label without making a
    second API call.
    """

    source: str
    branch: str
    set: ContentSet
    cached_version: str | None
    update_available: bool


def _validate_asset_size(
    path: str,
    declared_size_kb: int,
    actual_bytes: int,
) -> None:
    """Reject assets whose actual size exceeds the declared
    ``size_kb`` by more than 10% (Phase 54G / v1.37.0).

    Keeps content authors honest: a 50 KiB declaration that
    ships a 500 KiB image is rejected at download time, so
    the asset never reaches the cache or the client. The 10%
    tolerance covers rounding (declared KiB → actual bytes is
    a sub-KiB approximation) without letting wildly stale
    manifests through.

    Raises ``ContentSchemaError`` rather than a generic
    exception so the global handler maps it to HTTP 400 —
    same shape the manifest validator uses.
    """
    declared_bytes = declared_size_kb * 1024
    limit = int(declared_bytes * 1.10)
    if actual_bytes > limit:
        raise ContentSchemaError(
            (
                f"Asset {path!r} actual size {actual_bytes} bytes "
                f"exceeds declared {declared_size_kb} KiB + 10% "
                f"tolerance ({limit} bytes). Update the manifest "
                f"size_kb or shrink the asset."
            ),
        )


def _set_manifest_path(set_id: str) -> str:
    # Convention used by the pilot content repo: each set has
    # its OWN manifest fragment shipping the lesson list, plus
    # the top-level repo manifest catalogues every set. The
    # top-level manifest is the only file the loader fetches
    # when listing sets; per-set manifests are fetched only at
    # download time.
    return f"sets/{set_id}/manifest.yaml"


def _lesson_filenames_for_set(
    set_manifest: ContentManifest,
    set_id: str,
) -> list[str]:
    """Pull the lesson filename list from a set-level manifest.

    The set manifest's metadata MAY include a ``lessons`` list
    of filenames; when absent, the orchestrator falls back to
    a conventional ``lessons/01.json``..``lessons/{n}.json``
    scan based on ``lesson_count``.
    """
    matched: ContentSet | None = None
    for s in set_manifest.sets:
        if s.id == set_id:
            matched = s
            break
    if matched is None:
        raise ContentNotFoundError(
            f"Set {set_id!r} not advertised in its own manifest",
        )
    metadata_lessons = set_manifest.metadata.get("lessons")
    if isinstance(metadata_lessons, list) and all(
        isinstance(x, str) for x in metadata_lessons
    ):
        return list(metadata_lessons)
    # Conventional fallback: zero-padded indices.
    return [
        f"{i:02d}.json"
        for i in range(1, matched.lesson_count + 1)
    ]


class ContentLoaderService:
    """High-level orchestrator. Stateless aside from the cache
    root + adapter token; safe to instantiate per request OR
    per app lifetime.
    """

    def __init__(
        self,
        *,
        cache_root: Path,
        sources: list[SourceRef] | None = None,
        token: str | None = None,
        timeout_seconds: float = 20.0,
    ) -> None:
        self.cache_root = cache_root
        self.sources = sources or []
        self._adapter = GitHubRawAdapter(
            token=token, timeout_seconds=timeout_seconds,
        )
        self.cache_root.mkdir(parents=True, exist_ok=True)

    async def fetch_repo_manifest(
        self,
        source_ref: SourceRef,
        *,
        client: httpx.AsyncClient | None = None,
    ) -> ContentManifest:
        """Pull + parse + validate the top-level repo manifest."""
        text = await self._adapter.fetch_text(
            source_ref.source,
            source_ref.branch,
            MANIFEST_FILENAME,
            client=client,
        )
        return parse_manifest_yaml(text)

    async def list_sets(self) -> list[SetEntry]:
        """Return one ``SetEntry`` per (source, set) pair.

        Calls each upstream source once for its repo
        manifest. A source that's offline / 404 is logged and
        skipped — the Set Browser falls back to whatever the
        loader has already cached for that source. This
        keeps the page usable when the user is offline.
        """
        entries: list[SetEntry] = []
        async with httpx.AsyncClient(timeout=20.0) as client:
            for source_ref in self.sources:
                try:
                    manifest = await self.fetch_repo_manifest(
                        source_ref, client=client,
                    )
                except ContentLoaderError as err:
                    logger.warning(
                        "Could not fetch manifest for %s: %s",
                        source_ref,
                        err,
                    )
                    # Surface cached sets only, with no
                    # update info.
                    entries.extend(
                        self._cached_entries_for_source(source_ref),
                    )
                    continue
                for s in manifest.sets:
                    cached = latest_cached_version(
                        self.cache_root,
                        source_ref.source,
                        s.id,
                    )
                    update_available = cached is not None and cached != s.version
                    if cached is None:
                        update_available = False
                    entries.append(
                        SetEntry(
                            source=source_ref.source,
                            branch=source_ref.branch,
                            set=s,
                            cached_version=cached,
                            update_available=update_available,
                        ),
                    )
        return entries

    def _cached_entries_for_source(
        self,
        source_ref: SourceRef,
    ) -> list[SetEntry]:
        """Offline fallback: surface every cached set for the source.

        Used when the upstream manifest fetch fails (no
        network, 502, etc.). The user can still open lessons
        they downloaded earlier.
        """
        entries: list[SetEntry] = []
        base = self.cache_root / slugify_source(source_ref.source)
        if not base.is_dir():
            return entries
        for set_dir in base.iterdir():
            if not set_dir.is_dir():
                continue
            versions = list_cached_versions(
                self.cache_root,
                source_ref.source,
                set_dir.name,
            )
            if not versions:
                continue
            try:
                latest = versions[-1]
                manifest = read_manifest(
                    self.cache_root,
                    source_ref.source,
                    set_dir.name,
                    latest,
                )
            except ContentLoaderError as err:  # pragma: no cover
                logger.warning(
                    "Skipping cached set %s/%s: %s",
                    source_ref.source,
                    set_dir.name,
                    err,
                )
                continue
            for s in manifest.sets:
                if s.id != set_dir.name:
                    continue
                entries.append(
                    SetEntry(
                        source=source_ref.source,
                        branch=source_ref.branch,
                        set=s,
                        cached_version=latest,
                        update_available=False,
                    ),
                )
        return entries

    async def download_set(
        self,
        source: str,
        branch: str,
        set_id: str,
    ) -> SetEntry:
        """Fetch + cache one set end-to-end.

        Idempotent: a no-op when the cached version matches
        the upstream. Atomic via ``store_set`` (partial
        downloads never appear as cached).
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            repo_manifest = await self.fetch_repo_manifest(
                SourceRef(source=source, branch=branch),
                client=client,
            )
            target_set: ContentSet | None = None
            for s in repo_manifest.sets:
                if s.id == set_id:
                    target_set = s
                    break
            if target_set is None:
                raise ContentNotFoundError(
                    f"Set {set_id!r} not advertised by {source}",
                )

            # Reconcile cache vs upstream version.
            needs, cached = reconcile_set_version(
                self.cache_root,
                source,
                set_id,
                target_set.version,
            )
            if not needs:
                # Already up to date — surface a SetEntry
                # without making any further network calls.
                return SetEntry(
                    source=source,
                    branch=branch,
                    set=target_set,
                    cached_version=cached,
                    update_available=False,
                )

            # Clean any leftover tmp dir from a prior crash.
            cleanup_tmp_dirs(self.cache_root, source, set_id)

            # Fetch the set's own manifest (lesson list).
            set_manifest_text = await self._adapter.fetch_text(
                source,
                branch,
                _set_manifest_path(set_id),
                client=client,
            )
            set_manifest = parse_manifest_yaml(set_manifest_text)
            lesson_filenames = _lesson_filenames_for_set(
                set_manifest, set_id,
            )

            # Fetch every lesson file.
            lessons: dict[str, str] = {}
            for filename in lesson_filenames:
                text = await self._adapter.fetch_text(
                    source,
                    branch,
                    f"sets/{set_id}/lessons/{filename}",
                    client=client,
                )
                lessons[filename] = text

            # Phase 54 / v1.37.0: fetch declared assets
            # alongside lessons. Assets that 404 on the
            # upstream are logged + skipped so a stale
            # manifest entry doesn't fail the whole
            # download — the frontend falls back to text-
            # only display for missing images.
            assets: dict[str, bytes] = {}
            for asset_entry in target_set.assets:
                upstream_path = f"sets/{set_id}/assets/{asset_entry.path}"
                try:
                    payload = await self._adapter.fetch_bytes(
                        source,
                        branch,
                        upstream_path,
                        client=client,
                    )
                except ContentNotFoundError:
                    logger.warning(
                        "Asset %s declared by %s/%s manifest missing "
                        "upstream — skipping (frontend will text-fallback)",
                        asset_entry.path,
                        source,
                        set_id,
                    )
                    continue
                _validate_asset_size(
                    asset_entry.path,
                    asset_entry.size_kb,
                    len(payload),
                )
                assets[asset_entry.path] = payload

            # Materialise atomically.
            store_set(
                self.cache_root,
                source,
                set_id,
                target_set.version,
                manifest_yaml=set_manifest_text,
                lessons=lessons,
                assets=assets if assets else None,
            )
            return SetEntry(
                source=source,
                branch=branch,
                set=target_set,
                cached_version=target_set.version,
                update_available=False,
            )

    def get_lesson(
        self,
        source: str,
        set_id: str,
        lesson_filename: str,
        *,
        version: str | None = None,
    ) -> Lesson:
        """Return a cached lesson by source / set / filename.

        ``version`` defaults to the latest cached version. The
        viewer (Phase 44) typically passes the latest; deep
        links may pin a specific version.
        """
        if version is None:
            version = latest_cached_version(self.cache_root, source, set_id)
            if version is None:
                raise ContentNotFoundError(
                    f"Set {source}/{set_id} is not cached",
                )
        return read_lesson(
            self.cache_root, source, set_id, version, lesson_filename,
        )

    def list_cached_lesson_filenames(
        self,
        source: str,
        set_id: str,
        *,
        version: str | None = None,
    ) -> list[str]:
        """Return every lesson filename the cache holds for a set."""
        if version is None:
            version = latest_cached_version(self.cache_root, source, set_id)
            if version is None:
                return []
        lessons_dir = (
            cache_path_for_set(self.cache_root, source, set_id, version)
            / "lessons"
        )
        if not lessons_dir.is_dir():
            return []
        return sorted(p.name for p in lessons_dir.iterdir() if p.is_file())

    def has_cached_set(
        self,
        source: str,
        set_id: str,
        version: str | None = None,
    ) -> bool:
        if version is None:
            return latest_cached_version(self.cache_root, source, set_id) is not None
        return is_set_cached(self.cache_root, source, set_id, version)


def parse_source_refs_from_settings(
    raw_sources: list[dict[str, str]] | None,
) -> list[SourceRef]:
    """Build the SourceRef list from the plugin's YAML settings.

    Defensive: caller passes whatever YAML parsed into. We
    accept malformed entries and skip them with a warning so
    a broken config doesn't crash the plugin at activation
    time.
    """
    refs: list[SourceRef] = []
    if not raw_sources:
        return refs
    for entry in raw_sources:
        if not isinstance(entry, dict):
            continue
        source = entry.get("source")
        branch = entry.get("branch", "main")
        if not source or "/" not in source:
            continue
        refs.append(SourceRef(source=source, branch=branch))
    return refs
