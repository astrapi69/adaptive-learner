"""Content-set cache backup (issue #130).

Pins the dump -> restore round-trip of the filesystem content cache:
a downloaded set (manifest + lessons + a binary asset) is serialised
into the backup wire model and materialised back into a fresh cache,
byte-for-byte, so a restore onto a fresh install makes lessons openable
again — and user-generated sets (cache-only) are not lost.
"""

from __future__ import annotations

import base64

import pytest

from adaptive_learner_content_loader.cache import is_set_cached, store_set
from app.paths import get_cache_dir
from app.services.content_backup import (
    CONTENT_LOADER_DIR,
    dump_content_sets,
    restore_content_sets,
)

_MANIFEST = "schema_version: '1.0'\ntitle: Test Set\nlessons:\n  - 01.json\n"
_LESSON = '{"id": "01", "title": "Lesson One"}'
_ASSET = b"\x89PNG\r\n\x1a\n binary-bytes"


def _cache_root():
    return get_cache_dir() / CONTENT_LOADER_DIR


def _seed_cached_set(source: str, set_id: str, version: str) -> None:
    store_set(
        _cache_root(),
        source,
        set_id,
        version,
        manifest_yaml=_MANIFEST,
        lessons={"01.json": _LESSON},
        assets={"img/pic.png": _ASSET},
    )


def test_dump_includes_manifest_lessons_and_assets():
    _seed_cached_set("user-generated", "analysis-xyz", "1.0.0")
    entries = dump_content_sets()
    assert len(entries) == 1
    entry = entries[0]
    assert entry["source"] == "user-generated"
    assert entry["set_id"] == "analysis-xyz"
    assert entry["version"] == "1.0.0"
    by_name = {f["filename"]: f for f in entry["files"]}
    assert by_name["manifest.yaml"]["encoding"] == "text"
    assert by_name["lessons/01.json"]["body"] == _LESSON
    asset = by_name["assets/img/pic.png"]
    assert asset["encoding"] == "base64"
    assert base64.b64decode(asset["body"]) == _ASSET


def test_dump_handles_github_source_slug_roundtrip():
    _seed_cached_set("astrapi69/adaptive-learner-content", "fr-a1", "1.3.0")
    entries = dump_content_sets()
    sources = {e["source"] for e in entries}
    # The owner/name source survives the filesystem slug round-trip.
    assert "astrapi69/adaptive-learner-content" in sources


def test_restore_materialises_set_into_empty_cache():
    _seed_cached_set("user-generated", "analysis-xyz", "1.0.0")
    payload = dump_content_sets()
    # Wipe the cache to mimic a fresh install.
    import shutil

    shutil.rmtree(_cache_root(), ignore_errors=True)
    assert not is_set_cached(_cache_root(), "user-generated", "analysis-xyz", "1.0.0")

    summary = restore_content_sets(payload)
    assert summary == {"restored": 1, "skipped": 0, "errors": []}
    assert is_set_cached(_cache_root(), "user-generated", "analysis-xyz", "1.0.0")
    # Files came back byte-identical.
    version_dir = _cache_root() / "user-generated" / "analysis-xyz" / "v1.0.0"
    assert (version_dir / "lessons" / "01.json").read_text() == _LESSON
    assert (version_dir / "assets" / "img" / "pic.png").read_bytes() == _ASSET


def test_restore_skips_already_cached_set():
    _seed_cached_set("user-generated", "analysis-xyz", "1.0.0")
    payload = dump_content_sets()
    # Set is still present -> restore is a no-op skip, not a duplicate write.
    summary = restore_content_sets(payload)
    assert summary["restored"] == 0
    assert summary["skipped"] == 1
    assert summary["errors"] == []


def test_restore_rejects_path_traversal_filename():
    payload = [
        {
            "source": "user-generated",
            "set_id": "evil",
            "version": "1.0.0",
            "files": [{"filename": "../escape.txt", "body": "x", "encoding": "text"}],
        }
    ]
    summary = restore_content_sets(payload)
    assert summary["restored"] == 0
    assert len(summary["errors"]) == 1
    assert "escapes" in summary["errors"][0]


def test_restore_tolerates_non_list():
    assert restore_content_sets(None) == {"restored": 0, "skipped": 0, "errors": []}


@pytest.fixture(autouse=True)
def _clean_cache():
    """Each test starts and ends with an empty content cache."""
    import shutil

    shutil.rmtree(_cache_root(), ignore_errors=True)
    yield
    shutil.rmtree(_cache_root(), ignore_errors=True)
