"""Content-set cache backup (issue #130).

The 30 sync tables carry the user's DATA, but the downloaded lesson
CONTENT lives in a separate cache outside that surface:

- API mode: the filesystem under ``get_cache_dir()/content-loader/`` —
  ``{source-slug}/{set_id}/v{version}/{manifest.yaml, lessons/*.json,
  assets/**}`` (owned by the content-loader plugin).
- Dexie mode: the ``contentSets`` + ``contentSetFiles`` IndexedDB tables,
  which key files by the SAME relative path (``lessons/...``, ``assets/...``,
  ``manifest.yaml``).

Because the two layouts agree on relative-path-keyed files, one wire
model serialises both: a set is ``{source, set_id, version, files: [...]}``
where each file is ``{filename (relative path), body, encoding}`` with
``encoding`` either ``text`` (lesson JSON, manifest) or ``base64`` (binary
assets). This module produces/consumes that model for the API/filesystem
side; ``frontend/src/storage/backup.ts`` mirrors it for Dexie.

Why it matters: a restore onto a fresh install left every downloaded
lesson unopenable ("not downloaded"), and — worse — **user-generated**
sets (Lesson Creator / saved offline lessons / adaptive snapshots) exist
ONLY in this cache, so they were permanently lost. Including the cache in
the backup closes that data-loss gap.
"""

from __future__ import annotations

import base64
import json
import logging
import shutil
from pathlib import Path
from typing import Any

import yaml
from adaptive_learner_content_loader.cache import (
    cache_path_for_set,
    list_cached_versions,
    unslugify_source,
)
from adaptive_learner_content_loader.models import (
    CURRENT_SCHEMA_VERSION,
    ContentManifest,
    ContentSet,
)

from app.paths import get_cache_dir

logger = logging.getLogger(__name__)

CONTENT_LOADER_DIR = "content-loader"
MANIFEST_FILENAME = "manifest.yaml"

# Suffixes stored verbatim as text; everything else travels base64.
_TEXT_SUFFIXES = {".json", ".yaml", ".yml", ".md", ".txt", ".csv", ".svg"}


def _cache_root() -> Path:
    """Resolve the content-loader cache root via the path helpers."""
    return get_cache_dir() / CONTENT_LOADER_DIR


def _walk_set_files(version_dir: Path) -> list[dict[str, Any]]:
    """Serialise every file under a cached set version directory.

    Returns ``[{filename, body, encoding}]`` with ``filename`` the
    POSIX-relative path inside the version dir (so ``manifest.yaml``,
    ``lessons/01.json``, ``assets/img/x.png`` round-trip 1:1, matching
    the Dexie ``contentSetFiles`` keying).
    """
    files: list[dict[str, Any]] = []
    for path in sorted(version_dir.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(version_dir).as_posix()
        if path.suffix.lower() in _TEXT_SUFFIXES:
            files.append(
                {"filename": relative, "body": path.read_text(encoding="utf-8"), "encoding": "text"}
            )
        else:
            files.append(
                {
                    "filename": relative,
                    "body": base64.b64encode(path.read_bytes()).decode("ascii"),
                    "encoding": "base64",
                }
            )
    return files


def dump_content_sets() -> list[dict[str, Any]]:
    """Serialise every cached content set into the backup wire model.

    Content is per-install (not per-user); the whole local cache is
    included so a restore is self-contained. Returns ``[]`` when nothing
    is cached.
    """
    root = _cache_root()
    if not root.is_dir():
        return []
    entries: list[dict[str, Any]] = []
    for source_dir in sorted(root.iterdir()):
        if not source_dir.is_dir():
            continue
        source = unslugify_source(source_dir.name)
        for set_dir in sorted(source_dir.iterdir()):
            if not set_dir.is_dir():
                continue
            set_id = set_dir.name
            for version in list_cached_versions(root, source, set_id):
                version_dir = cache_path_for_set(root, source, set_id, version)
                entries.append(
                    {
                        "source": source,
                        "set_id": set_id,
                        "version": version,
                        "files": _walk_set_files(version_dir),
                    }
                )
    return entries


def _synthesize_manifest_yaml(entry: dict[str, Any]) -> str | None:
    """Build a ``manifest.yaml`` for a set whose files lack one (#134).

    A Dexie-origin user-generated set carries its title in the
    ``contentSets`` ROW (the wire entry's ``meta``) and ships only lesson
    files — no ``manifest.yaml``. Restored into the API filesystem cache,
    which derives all metadata from the manifest, the set lands
    manifest-less: the Set Browser / Dashboard fall back to the raw
    ``set_id`` for the title and cannot resolve the lesson, so the
    step-progress count is lost. Synthesising a one-set manifest from
    ``meta`` (mirroring ``content-loader.save_user_set``) restores both.

    Returns the YAML text, or None when ``meta`` has no usable title.
    """
    meta = entry.get("meta")
    if not isinstance(meta, dict):
        return None
    title = meta.get("title")
    if not isinstance(title, str) or not title.strip():
        return None

    lesson_filenames = [
        file_entry["filename"].removeprefix("lessons/")
        for file_entry in entry.get("files", [])
        if isinstance(file_entry, dict)
        and str(file_entry.get("filename", "")).startswith("lessons/")
    ]
    lesson_count = meta.get("lesson_count")
    if not isinstance(lesson_count, int):
        lesson_count = len(lesson_filenames)
    tags = meta.get("tags")
    if isinstance(tags, str):
        try:
            tags = json.loads(tags)
        except (ValueError, TypeError):
            tags = []
    if not isinstance(tags, list):
        tags = []

    origin = meta.get("domain") or "language"
    content_set = ContentSet(
        id=entry["set_id"],
        title=title,
        title_native=meta.get("title_native"),
        target_language=meta.get("target_language") or meta.get("language") or "en",
        source_language=meta.get("source_language") or "en",
        level=meta.get("level") or "A1",
        version=entry["version"],
        lesson_count=lesson_count,
        domain=origin,
        description=meta.get("description"),
        tags=tags,
        assets=[],
    )
    manifest = ContentManifest(
        schema_version=CURRENT_SCHEMA_VERSION,
        name=title,
        description=meta.get("description"),
        sets=[content_set],
        # ``lessons`` lets the loader resolve the user-generated lesson
        # filenames (which are ``{lesson_id}.json``, not ``01.json``).
        metadata={"author": "user", "origin": origin, "lessons": lesson_filenames},
    )
    return yaml.safe_dump(
        manifest.model_dump(mode="json", exclude_none=True),
        allow_unicode=True,
        sort_keys=False,
    )


def _write_set(root: Path, entry: dict[str, Any]) -> None:
    """Materialise one set entry into the cache atomically.

    Writes to ``v{version}.tmp`` then renames into place — the same
    manifest-last-via-rename invariant ``store_set`` relies on, so a
    present version dir always means a complete set.

    If the entry has no ``manifest.yaml`` of its own (a Dexie-origin
    user-generated set), one is synthesised from ``meta`` so the API
    cache is valid and the title + lesson resolve (#134).
    """
    source = entry["source"]
    set_id = entry["set_id"]
    version = entry["version"]
    version_dir = cache_path_for_set(root, source, set_id, version)
    if (version_dir / MANIFEST_FILENAME).exists():
        return  # already cached — leave the local copy untouched

    files = list(entry.get("files", []))
    has_manifest = any(
        isinstance(f, dict) and f.get("filename") == MANIFEST_FILENAME for f in files
    )
    if not has_manifest:
        synthesized = _synthesize_manifest_yaml(entry)
        if synthesized is not None:
            files.append({"filename": MANIFEST_FILENAME, "body": synthesized, "encoding": "text"})
            logger.info(
                "Synthesised manifest for %s/%s@v%s from backup metadata (title=%r)",
                source,
                set_id,
                version,
                (entry.get("meta") or {}).get("title"),
            )

    tmp_dir = version_dir.with_name(version_dir.name + ".tmp")
    if tmp_dir.exists():
        shutil.rmtree(tmp_dir)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_root = tmp_dir.resolve()
    for file_entry in files:
        relative = file_entry["filename"]
        target = (tmp_dir / relative).resolve()
        # Path-traversal guard: a crafted ``..`` filename must not escape
        # the set's tmp dir (same invariant as cache.read_asset).
        if not str(target).startswith(str(tmp_root)):
            raise ValueError(f"file path escapes the set directory: {relative!r}")
        target.parent.mkdir(parents=True, exist_ok=True)
        if file_entry.get("encoding") == "base64":
            target.write_bytes(base64.b64decode(file_entry["body"]))
        else:
            target.write_text(file_entry["body"], encoding="utf-8")

    version_dir.parent.mkdir(parents=True, exist_ok=True)
    # A manifest-less version dir is an incomplete set (e.g. a prior
    # restore that landed without a synthesised manifest); replace it so
    # the move lands the complete set rather than nesting inside it.
    if version_dir.exists():
        shutil.rmtree(version_dir)
    shutil.move(str(tmp_dir), str(version_dir))


def restore_content_sets(entries: Any) -> dict[str, Any]:
    """Restore cached content sets from the backup wire model.

    Merge semantics: a set already present locally (its version dir holds
    a manifest) is left untouched; missing sets are written. Returns a
    per-call summary so the restore endpoint can report it.
    """
    summary: dict[str, Any] = {"restored": 0, "skipped": 0, "errors": []}
    if not isinstance(entries, list):
        return summary
    root = _cache_root()
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        label = f"{entry.get('source')}/{entry.get('set_id')}@v{entry.get('version')}"
        try:
            version_dir = cache_path_for_set(
                root, entry["source"], entry["set_id"], entry["version"]
            )
            if (version_dir / "manifest.yaml").exists():
                summary["skipped"] += 1
                logger.info("Content set already cached, skipping: %s", label)
                continue
            _write_set(root, entry)
            summary["restored"] += 1
            logger.info("Restored content set: %s (%d files)", label, len(entry.get("files", [])))
        except Exception as exc:  # noqa: BLE001 — collect, never abort the restore
            summary["errors"].append(f"{label}: {exc}")
            logger.error("Failed to restore content set %s: %s", label, exc, exc_info=True)
    logger.info(
        "Content-set restore complete: %d restored, %d skipped, %d errors",
        summary["restored"],
        summary["skipped"],
        len(summary["errors"]),
    )
    return summary


__all__ = ["dump_content_sets", "restore_content_sets"]
