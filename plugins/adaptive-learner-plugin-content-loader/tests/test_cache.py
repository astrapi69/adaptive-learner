"""Tests for the filesystem cache
(Phase 43 / EXP-002 / 2C-cache — P-105 + Q-100).
"""

from __future__ import annotations

import json
import shutil
import textwrap
from pathlib import Path

import pytest

from adaptive_learner_content_loader.cache import (
    cache_path_for_set,
    cleanup_tmp_dirs,
    is_set_cached,
    iterate_cached_sources,
    latest_cached_version,
    list_cached_versions,
    prune_old_versions,
    read_asset,
    read_lesson,
    read_manifest,
    reconcile_set_version,
    slugify_source,
    store_set,
    unslugify_source,
)
from adaptive_learner_content_loader.exceptions import (
    ContentNotFoundError,
    ContentSchemaError,
)


SOURCE = "astrapi69/adaptive-learner-content"
SET_ID = "language-fr-a1"
VERSION = "1.0.0"

VALID_MANIFEST = textwrap.dedent(
    """
    schema_version: '1.0'
    name: Pilot
    sets:
      - id: language-fr-a1
        title: French A1
        language: fr
        level: A1
        version: '1.0.0'
        lesson_count: 1
    """
).strip()

VALID_LESSON = json.dumps(
    {
        "id": "01-greetings",
        "title": "Greetings",
        "cards": [{"id": "bonjour", "front": "Bonjour", "back": "Hello"}],
        "steps": [
            {
                "id": "intro",
                "type": "theory",
                "body": "Greetings overview.",
            },
        ],
    }
)


# --- Source slug -------------------------------------------------------


class TestSourceSlug:
    def test_round_trip(self) -> None:
        slug = slugify_source(SOURCE)
        assert slug == "astrapi69--adaptive-learner-content"
        assert unslugify_source(slug) == SOURCE

    def test_no_slash_in_slug(self) -> None:
        # Sanity: slugifying ALWAYS removes the slash so the
        # filesystem path stays flat (one dir per source).
        for src in (
            "astrapi69/adaptive-learner-content",
            "foo/bar-baz",
            "owner/with-multiple/slashes",
        ):
            assert "/" not in slugify_source(src)


# --- Path resolution + presence ---------------------------------------


class TestPathHelpers:
    def test_cache_path_shape(self, tmp_path: Path) -> None:
        path = cache_path_for_set(tmp_path, SOURCE, SET_ID, VERSION)
        assert path == (
            tmp_path
            / "astrapi69--adaptive-learner-content"
            / "language-fr-a1"
            / "v1.0.0"
        )

    def test_is_set_cached_false_when_empty(self, tmp_path: Path) -> None:
        assert is_set_cached(tmp_path, SOURCE, SET_ID, VERSION) is False

    def test_is_set_cached_false_without_manifest(self, tmp_path: Path) -> None:
        # Create the dir but without manifest — must NOT be
        # treated as cached (partial download).
        cache_path_for_set(tmp_path, SOURCE, SET_ID, VERSION).mkdir(
            parents=True,
        )
        assert is_set_cached(tmp_path, SOURCE, SET_ID, VERSION) is False


# --- Store + read ------------------------------------------------------


class TestStoreSet:
    def test_atomic_write(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        assert is_set_cached(tmp_path, SOURCE, SET_ID, VERSION)

        # No tmp directories left after a successful write.
        set_parent = tmp_path / slugify_source(SOURCE) / SET_ID
        assert not any(p.name.endswith(".tmp") for p in set_parent.iterdir())

    def test_idempotent_on_second_call(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        # Calling again with the same version is a no-op — the
        # caller should consult ``reconcile_set_version`` first.
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml="overwritten?",  # would be ignored
            lessons={"x.json": "x"},
        )
        manifest = read_manifest(tmp_path, SOURCE, SET_ID, VERSION)
        assert manifest.name == "Pilot"

    def test_drops_leftover_tmp_dir_on_retry(self, tmp_path: Path) -> None:
        # Simulate a previous failed download leaving a tmp
        # dir behind. The next store_set call must clean it
        # up before writing.
        tmp_dir = (
            cache_path_for_set(tmp_path, SOURCE, SET_ID, VERSION)
        ).with_name("v1.0.0.tmp")
        tmp_dir.mkdir(parents=True)
        (tmp_dir / "garbage").write_text("leftover")

        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        assert not tmp_dir.exists()
        assert is_set_cached(tmp_path, SOURCE, SET_ID, VERSION)

    def test_assets_written_under_assets_dir(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
            assets={"img/cover.png": b"PNGDATA", "audio/bonjour.mp3": b"MP3"},
        )
        set_dir = cache_path_for_set(tmp_path, SOURCE, SET_ID, VERSION)
        assert (set_dir / "assets" / "img" / "cover.png").read_bytes() == b"PNGDATA"
        assert (set_dir / "assets" / "audio" / "bonjour.mp3").read_bytes() == b"MP3"


class TestReadCache:
    def test_read_manifest(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        manifest = read_manifest(tmp_path, SOURCE, SET_ID, VERSION)
        assert manifest.name == "Pilot"
        assert len(manifest.sets) == 1

    def test_read_manifest_missing(self, tmp_path: Path) -> None:
        with pytest.raises(ContentNotFoundError):
            read_manifest(tmp_path, SOURCE, SET_ID, VERSION)

    def test_read_asset_round_trip(self, tmp_path: Path) -> None:
        """Phase 54A / v1.37.0 — store_set + read_asset
        round-trip on a binary blob keeps bytes intact."""
        png_bytes = b"\x89PNG\r\n\x1a\n" + b"FAKE_PNG_PAYLOAD"
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
            assets={"img/cover.png": png_bytes},
        )
        out = read_asset(
            tmp_path, SOURCE, SET_ID, VERSION, "img/cover.png",
        )
        assert out == png_bytes

    def test_read_asset_missing(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        with pytest.raises(ContentNotFoundError):
            read_asset(
                tmp_path, SOURCE, SET_ID, VERSION, "img/missing.png",
            )

    def test_read_asset_path_traversal_blocked(
        self, tmp_path: Path,
    ) -> None:
        """``..`` segments in an asset path are rejected at read
        time, even if a future bug ever let one past the manifest
        validator. Phase 54A / v1.37.0."""
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
            assets={"img/cover.png": b"SAFE"},
        )
        with pytest.raises(ContentNotFoundError):
            read_asset(
                tmp_path,
                SOURCE,
                SET_ID,
                VERSION,
                "../../../etc/passwd",
            )

    def test_read_lesson(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        lesson = read_lesson(
            tmp_path, SOURCE, SET_ID, VERSION, "01-greetings.json",
        )
        assert lesson.id == "01-greetings"

    def test_read_lesson_missing(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        with pytest.raises(ContentNotFoundError):
            read_lesson(
                tmp_path, SOURCE, SET_ID, VERSION, "00-not-there.json",
            )

    def test_read_corrupted_lesson(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            VERSION,
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-broken.json": "{not valid json"},
        )
        with pytest.raises(ContentSchemaError):
            read_lesson(
                tmp_path, SOURCE, SET_ID, VERSION, "01-broken.json",
            )


# --- Version listing + reconciliation ---------------------------------


class TestVersionListing:
    def test_list_versions_empty(self, tmp_path: Path) -> None:
        assert list_cached_versions(tmp_path, SOURCE, SET_ID) == []
        assert latest_cached_version(tmp_path, SOURCE, SET_ID) is None

    def test_list_versions_sorted_ascending(self, tmp_path: Path) -> None:
        for v in ["1.0.0", "1.2.0", "1.0.1", "2.0.0-rc1"]:
            store_set(
                tmp_path,
                SOURCE,
                SET_ID,
                v,
                manifest_yaml=VALID_MANIFEST,
                lessons={"01-greetings.json": VALID_LESSON},
            )
        versions = list_cached_versions(tmp_path, SOURCE, SET_ID)
        assert versions == ["1.0.0", "1.0.1", "1.2.0", "2.0.0-rc1"]
        assert latest_cached_version(tmp_path, SOURCE, SET_ID) == "2.0.0-rc1"

    def test_list_versions_ignores_tmp_dirs(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        # Simulate a half-written download
        tmp_dir = cache_path_for_set(
            tmp_path, SOURCE, SET_ID, "1.0.0",
        ).with_name("v2.0.0.tmp")
        tmp_dir.mkdir(parents=True)
        assert list_cached_versions(tmp_path, SOURCE, SET_ID) == ["1.0.0"]

    def test_list_versions_ignores_versions_without_manifest(
        self,
        tmp_path: Path,
    ) -> None:
        # A dir exists but no manifest inside — must NOT
        # appear in the list (partial download).
        cache_path_for_set(tmp_path, SOURCE, SET_ID, "1.0.0").mkdir(
            parents=True,
        )
        assert list_cached_versions(tmp_path, SOURCE, SET_ID) == []


class TestReconcileSetVersion:
    def test_uncached_means_download(self, tmp_path: Path) -> None:
        needs, cached = reconcile_set_version(
            tmp_path, SOURCE, SET_ID, "1.0.0",
        )
        assert needs is True
        assert cached is None

    def test_same_version_no_download(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        needs, cached = reconcile_set_version(
            tmp_path, SOURCE, SET_ID, "1.0.0",
        )
        assert needs is False
        assert cached == "1.0.0"

    def test_newer_upstream_means_download(self, tmp_path: Path) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        needs, cached = reconcile_set_version(
            tmp_path, SOURCE, SET_ID, "1.0.1",
        )
        assert needs is True
        assert cached == "1.0.0"


# --- Prune + cleanup --------------------------------------------------


class TestPrune:
    def test_keep_latest_default_drops_old_versions(
        self,
        tmp_path: Path,
    ) -> None:
        for v in ["1.0.0", "1.1.0", "1.2.0"]:
            store_set(
                tmp_path,
                SOURCE,
                SET_ID,
                v,
                manifest_yaml=VALID_MANIFEST,
                lessons={"01-greetings.json": VALID_LESSON},
            )
        dropped = prune_old_versions(tmp_path, SOURCE, SET_ID)
        assert dropped == ["1.0.0", "1.1.0"]
        assert list_cached_versions(tmp_path, SOURCE, SET_ID) == ["1.2.0"]

    def test_keep_latest_zero_rejected(self, tmp_path: Path) -> None:
        with pytest.raises(ValueError):
            prune_old_versions(
                tmp_path, SOURCE, SET_ID, keep_latest=0,
            )

    def test_prune_noop_when_below_threshold(
        self,
        tmp_path: Path,
    ) -> None:
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        # keep_latest=2 with only 1 cached version → nothing
        # to drop.
        dropped = prune_old_versions(
            tmp_path, SOURCE, SET_ID, keep_latest=2,
        )
        assert dropped == []
        assert list_cached_versions(tmp_path, SOURCE, SET_ID) == ["1.0.0"]


class TestCleanupTmpDirs:
    def test_drops_only_tmp_dirs(self, tmp_path: Path) -> None:
        # Live version + leftover tmp
        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=VALID_MANIFEST,
            lessons={"01-greetings.json": VALID_LESSON},
        )
        tmp_dir = cache_path_for_set(
            tmp_path, SOURCE, SET_ID, "1.0.0",
        ).with_name("v2.0.0.tmp")
        tmp_dir.mkdir(parents=True)
        (tmp_dir / "garbage").write_text("x")

        removed = cleanup_tmp_dirs(tmp_path, SOURCE, SET_ID)
        assert removed == 1
        assert not tmp_dir.exists()
        # Live version untouched
        assert is_set_cached(tmp_path, SOURCE, SET_ID, "1.0.0")


# --- Cross-source iteration ---------------------------------------------


class TestIterateCachedSources:
    def test_empty_cache(self, tmp_path: Path) -> None:
        assert list(iterate_cached_sources(tmp_path)) == []

    def test_yields_all_owners(self, tmp_path: Path) -> None:
        for source in ("astrapi69/content", "other/repo"):
            store_set(
                tmp_path,
                source,
                "set-x",
                "1.0.0",
                manifest_yaml=VALID_MANIFEST,
                lessons={"01-greetings.json": VALID_LESSON},
            )
        assert sorted(iterate_cached_sources(tmp_path)) == [
            "astrapi69/content",
            "other/repo",
        ]

    def test_skips_non_slug_dirs(self, tmp_path: Path) -> None:
        # Directories without the "owner--name" shape get
        # skipped (someone may have dropped junk in the
        # cache root).
        (tmp_path / "not-a-source-dir").mkdir()
        assert list(iterate_cached_sources(tmp_path)) == []

    def test_missing_root(self, tmp_path: Path) -> None:
        # Cache root that doesn't exist yet — degrade
        # gracefully (no exception, empty list).
        missing = tmp_path / "never-created"
        assert list(iterate_cached_sources(missing)) == []
