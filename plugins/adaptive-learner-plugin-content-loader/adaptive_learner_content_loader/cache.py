"""Filesystem cache (Phase 43 / EXP-002 / 2C-cache — P-105).

Backend-side cache for downloaded content sets. The browser-side
equivalent (Dexie tables ``contentSets`` + ``contentSetFiles``)
lives in ``frontend/src/storage/dexie-storage.ts`` and lands in
commit 6. The two implementations share the same cache-key
contract:

  cache_root / {source-slug} / {set_id} / v{version} / files...

Where ``source-slug`` slugifies a GitHub ``owner/name`` slash
into a filesystem-safe ``owner--name`` shape so the cache
tree maps 1:1 onto the IndexedDB key space.

The backend caller MUST resolve ``cache_root`` via
``app.paths.get_cache_dir() / "content-loader"`` so the test-
isolation tripwire (``ADAPTIVE_LEARNER_TEST=1`` + tmp dir +
production marker) protects E2E runs from touching the real
cache. This module itself takes the root as a parameter so it
stays unit-testable without app imports.

Atomicity: a download writes to ``v{version}.tmp/``, then
renames into place once every file lands. Partial downloads
NEVER appear as cached.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Iterable

from .exceptions import ContentNotFoundError
from .manifest_parser import parse_manifest_yaml, parse_lesson_json
from .models import ContentManifest
from .schema import Lesson
from .version import needs_update


CONTENT_LOADER_DIR = "content-loader"


def slugify_source(source: str) -> str:
    """Turn ``owner/name`` into a filesystem-safe slug.

    Mirrors the Dexie-side cache-key shape (commit 6 — same
    rule, IndexedDB key). The transformation is invertible:
    ``unslugify_source`` round-trips so the Set Browser can
    display the original ``owner/name`` string after reading
    a cache directory listing.
    """
    return source.replace("/", "--")


def unslugify_source(slug: str) -> str:
    """Inverse of ``slugify_source``."""
    return slug.replace("--", "/")


def cache_path_for_set(
    cache_root: Path,
    source: str,
    set_id: str,
    version: str,
) -> Path:
    """Return the canonical cache directory for a set version.

    Does NOT create the directory. ``is_set_cached`` is the
    presence check; ``store_set`` is the writer.
    """
    return (
        cache_root
        / slugify_source(source)
        / set_id
        / f"v{version}"
    )


def is_set_cached(
    cache_root: Path,
    source: str,
    set_id: str,
    version: str,
) -> bool:
    """True iff the set's version directory holds a manifest.

    A directory existing without a manifest is treated as a
    failed download — ``store_set`` writes the manifest LAST
    (after every lesson + asset) so a present manifest means
    every file in the set is present too.
    """
    return (cache_path_for_set(cache_root, source, set_id, version)
            / "manifest.yaml").exists()


def list_cached_versions(
    cache_root: Path,
    source: str,
    set_id: str,
) -> list[str]:
    """Return every cached version directory's bare version string.

    Returns the entries in semver-ascending order so the
    caller's "use latest" path can just take the last
    element. Skips ``v{version}.tmp`` partial-download
    directories.
    """
    base = cache_root / slugify_source(source) / set_id
    if not base.is_dir():
        return []
    versions: list[str] = []
    for child in base.iterdir():
        if not child.is_dir():
            continue
        name = child.name
        if not name.startswith("v"):
            continue
        if name.endswith(".tmp"):
            continue
        if not (child / "manifest.yaml").exists():
            continue
        versions.append(name[1:])  # strip leading "v"
    from .version import _Version

    versions.sort(key=_Version)
    return versions


def latest_cached_version(
    cache_root: Path,
    source: str,
    set_id: str,
) -> str | None:
    """Convenience: highest cached version, or None if uncached."""
    versions = list_cached_versions(cache_root, source, set_id)
    return versions[-1] if versions else None


def store_set(
    cache_root: Path,
    source: str,
    set_id: str,
    version: str,
    *,
    manifest_yaml: str,
    lessons: dict[str, str],
    assets: dict[str, bytes] | None = None,
) -> Path:
    """Materialise a downloaded set into the cache atomically.

    Args:
        manifest_yaml: raw manifest.yaml text the upstream
            published. Stored verbatim so a later read can
            re-parse if the loader's schema evolves.
        lessons: mapping of ``{lesson_id}.json`` filename →
            JSON payload as text.
        assets: optional mapping of relative asset path →
            raw bytes. Written under ``assets/`` inside the
            cache directory; the asset loader (Phase 44)
            reads from there.

    Writes to ``v{version}.tmp/`` first, then renames into
    place once every file has landed. The rename is the only
    moment the set becomes visible to readers.

    Returns the final cache directory path.
    """
    set_dir = cache_path_for_set(cache_root, source, set_id, version)
    if set_dir.exists():
        # Idempotent: already cached. Caller decides whether
        # to re-download via ``needs_update``.
        return set_dir

    tmp_dir = set_dir.with_name(set_dir.name + ".tmp")
    if tmp_dir.exists():
        # Leftover from a previous failed attempt. Drop it.
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # 1) Lesson files
    lessons_dir = tmp_dir / "lessons"
    lessons_dir.mkdir(exist_ok=True)
    for filename, payload in lessons.items():
        target = lessons_dir / filename
        target.write_text(payload, encoding="utf-8")

    # 2) Optional assets
    if assets:
        for rel_path, blob in assets.items():
            target = tmp_dir / "assets" / rel_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(blob)

    # 3) Manifest LAST so the presence check stays atomic
    (tmp_dir / "manifest.yaml").write_text(manifest_yaml, encoding="utf-8")

    # Final rename (cross-FS-safe via shutil.move).
    set_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(tmp_dir), str(set_dir))
    return set_dir


def read_manifest(
    cache_root: Path,
    source: str,
    set_id: str,
    version: str,
) -> ContentManifest:
    """Read + validate the cached manifest.

    Raises ``ContentNotFoundError`` if the set is not cached.
    """
    manifest_path = (
        cache_path_for_set(cache_root, source, set_id, version)
        / "manifest.yaml"
    )
    if not manifest_path.is_file():
        raise ContentNotFoundError(
            f"No cached manifest for {source}/{set_id}@v{version}",
            detail=f"Looked at: {manifest_path}",
        )
    return parse_manifest_yaml(manifest_path.read_text(encoding="utf-8"))


def read_lesson(
    cache_root: Path,
    source: str,
    set_id: str,
    version: str,
    lesson_filename: str,
) -> Lesson:
    """Read + validate a single lesson.json from the cache.

    Args:
        lesson_filename: file name inside ``lessons/`` (e.g.
            ``01-greetings.json``). NOT a lesson id alone —
            the manifest links set→lesson by filename so the
            loader is content-author-friendly (rename a file,
            update one manifest entry, no DB migration).

    Raises ``ContentNotFoundError`` if the file is missing,
    ``ContentSchemaError`` on validation failure.
    """
    lessons_root = cache_path_for_set(cache_root, source, set_id, version) / "lessons"
    lesson_path = (lessons_root / lesson_filename).resolve()
    # Path-traversal guard (mirrors ``read_asset``): a ``..`` or
    # absolute segment that slips past the route's ``{filename}``
    # converter must not escape the set's ``lessons/`` directory.
    # Defense-in-depth — the JSON-parse gate downstream would also
    # reject non-lesson files, but the read path is the canonical
    # place to enforce the cache-isolation invariant.
    if not str(lesson_path).startswith(str(lessons_root.resolve())):
        raise ContentNotFoundError(
            f"Lesson path escapes the cache root: {lesson_filename!r}",
        )
    if not lesson_path.is_file():
        raise ContentNotFoundError(
            (
                f"No cached lesson "
                f"{lesson_filename} in {source}/{set_id}@v{version}"
            ),
            detail=f"Looked at: {lesson_path}",
        )
    return parse_lesson_json(lesson_path.read_text(encoding="utf-8"))


def read_asset(
    cache_root: Path,
    source: str,
    set_id: str,
    version: str,
    asset_path: str,
) -> bytes:
    """Read a single cached asset by relative path (Phase 54 /
    v1.37.0).

    ``asset_path`` is the same relative path declared in the
    set manifest's ``assets[*].path`` (e.g. ``img/sunrise.png``).
    The function resolves it under
    ``{cache_root}/.../v{version}/assets/`` and reads the raw
    bytes.

    Path-traversal guard: resolves the final path and asserts
    it stays under the set's cache directory. A relative
    ``..`` segment that slips past the manifest validator
    can't escape — the resolve check rejects it.

    Raises ``ContentNotFoundError`` if the file is missing.
    """
    set_dir = cache_path_for_set(cache_root, source, set_id, version)
    asset_root = set_dir / "assets"
    target = (asset_root / asset_path).resolve()
    # Defense-in-depth: the manifest validator (P-?, 54G)
    # already rejects ``..`` segments in declared paths, but
    # the read path stays the canonical place to also
    # enforce the invariant — Python file IO has bitten this
    # project once before (see ``.claude/rules/architecture.md``
    # plugin-ZIP path-traversal note).
    if not str(target).startswith(str(asset_root.resolve())):
        raise ContentNotFoundError(
            f"Asset path escapes the cache root: {asset_path!r}",
        )
    if not target.is_file():
        raise ContentNotFoundError(
            (
                f"No cached asset "
                f"{asset_path} in {source}/{set_id}@v{version}"
            ),
            detail=f"Looked at: {target}",
        )
    return target.read_bytes()


def prune_old_versions(
    cache_root: Path,
    source: str,
    set_id: str,
    *,
    keep_latest: int = 1,
) -> list[str]:
    """Drop every cached version below the ``keep_latest`` newest.

    Used by the download orchestrator (commit 6) after a
    successful re-download to bound disk usage. Returns the
    list of deleted version strings.

    A ``keep_latest=0`` is rejected — leaving zero cached
    versions while pruning would yank content from under any
    open lesson viewer. Use ``shutil.rmtree`` on the set
    directory if you mean "drop everything".
    """
    if keep_latest < 1:
        raise ValueError("keep_latest must be >= 1")
    versions = list_cached_versions(cache_root, source, set_id)
    if len(versions) <= keep_latest:
        return []
    to_drop = versions[:-keep_latest]
    for version in to_drop:
        target = cache_path_for_set(cache_root, source, set_id, version)
        shutil.rmtree(target, ignore_errors=True)
    return to_drop


def cleanup_tmp_dirs(
    cache_root: Path,
    source: str,
    set_id: str,
) -> int:
    """Drop every ``v*.tmp`` directory under the set.

    Called on plugin activation so a crash-mid-download from
    a previous run does not leave junk on disk. Returns the
    count of removed directories.
    """
    base = cache_root / slugify_source(source) / set_id
    if not base.is_dir():
        return 0
    removed = 0
    for child in base.iterdir():
        if child.is_dir() and child.name.endswith(".tmp"):
            shutil.rmtree(child, ignore_errors=True)
            removed += 1
    return removed


def reconcile_set_version(
    cache_root: Path,
    source: str,
    set_id: str,
    upstream_version: str,
) -> tuple[bool, str | None]:
    """Decide whether to re-download a set.

    Returns ``(should_download, cached_version_or_none)``:
    - ``(True, None)``: set never cached, full download needed.
    - ``(True, "1.0.0")``: cached version exists but upstream
      is newer.
    - ``(False, "1.0.0")``: cached version matches or exceeds
      upstream — keep the existing files.

    Used by the download orchestrator (commit 6) to skip
    network round-trips when nothing changed.
    """
    cached = latest_cached_version(cache_root, source, set_id)
    if cached is None:
        return True, None
    return needs_update(cached, upstream_version), cached


def iterate_cached_sources(cache_root: Path) -> Iterable[str]:
    """Yield every ``owner/name`` slug present in the cache.

    Helper for the offline path: the Set Browser can list
    every set the user has downloaded EVER (across sources)
    without making a single network call.
    """
    if not cache_root.is_dir():
        return
    for child in cache_root.iterdir():
        if not child.is_dir():
            continue
        if "--" not in child.name:
            continue
        yield unslugify_source(child.name)
