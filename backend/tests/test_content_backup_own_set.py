"""A restore brings back a lesson removed from an own set after the backup (#3932).

API half; the Dexie half is
``frontend/src/storage/backup/own-set-restore.test.ts`` (#2053: one test per
mode).

An own set always carries version 1.0.0, so its cache path cannot tell the set
in the backup from the set on the device. The restore therefore compares the
lessons: it adds what the device lacks and keeps the device's version of a
lesson both sides hold (owner decision on #3787, 2026-10-31).

The fixtures go through the producers: ``ContentLoaderService.save_user_set``
writes the set and ``dump_content_sets`` the backup, as the app does.
"""

from __future__ import annotations

import json
from pathlib import Path

import yaml
from adaptive_learner_content_loader.cache import cache_path_for_set, store_set
from adaptive_learner_content_loader.schema import Lesson
from adaptive_learner_content_loader.service import (
    USER_GENERATED_SOURCE,
    USER_SET_VERSION,
    ContentLoaderService,
)

from app.paths import get_cache_dir
from app.services.content_backup import (
    CONTENT_LOADER_DIR,
    dump_content_sets,
    restore_content_sets,
)

LESSON_FIXTURE = (
    Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "user-set-lesson" / "lesson.json"
)
SET_ID = "my-set"


def _cache_root() -> Path:
    return get_cache_dir() / CONTENT_LOADER_DIR


def _lesson(lesson_id: str, title: str) -> Lesson:
    raw = json.loads(LESSON_FIXTURE.read_text(encoding="utf-8"))
    return Lesson.model_validate({**raw, "id": lesson_id, "title": title})


def _save_own_set(lessons: list[Lesson]) -> None:
    ContentLoaderService(cache_root=_cache_root(), sources=[]).save_user_set(
        set_id=SET_ID,
        title="My set",
        target_language="es",
        level="A1",
        origin="imported",
        lessons=lessons,
    )


def _set_dir() -> Path:
    return cache_path_for_set(_cache_root(), USER_GENERATED_SOURCE, SET_ID, USER_SET_VERSION)


def _lesson_titles() -> dict[str, str]:
    return {
        path.name: json.loads(path.read_text(encoding="utf-8"))["title"]
        for path in sorted((_set_dir() / "lessons").iterdir())
    }


def _manifest_lesson_count() -> int:
    manifest = yaml.safe_load((_set_dir() / "manifest.yaml").read_text(encoding="utf-8"))
    return manifest["sets"][0]["lesson_count"]


def test_restore_brings_back_a_lesson_removed_from_an_own_set_after_the_backup() -> None:
    _save_own_set([_lesson("l-1", "One"), _lesson("l-2", "Two")])
    backup = dump_content_sets()
    # After the backup: l-2 is removed and l-1 edited.
    _save_own_set([_lesson("l-1", "One, edited")])

    summary = restore_content_sets(backup)

    assert summary == {"restored": 1, "skipped": 0, "errors": []}
    assert _lesson_titles() == {"l-1.json": "One, edited", "l-2.json": "Two"}
    assert _manifest_lesson_count() == 2
    listed = ContentLoaderService(
        cache_root=_cache_root(), sources=[]
    ).list_cached_lesson_filenames(USER_GENERATED_SOURCE, SET_ID)
    assert sorted(listed) == ["l-1.json", "l-2.json"]


def test_restore_skips_an_own_set_whose_lessons_the_device_all_holds() -> None:
    _save_own_set([_lesson("l-1", "One")])
    backup = dump_content_sets()
    # The device gained a lesson since; nothing is missing from it.
    _save_own_set([_lesson("l-1", "One"), _lesson("l-3", "Three")])

    summary = restore_content_sets(backup)

    assert summary == {"restored": 0, "skipped": 1, "errors": []}
    assert sorted(_lesson_titles()) == ["l-1.json", "l-3.json"]
    assert _manifest_lesson_count() == 2


def test_restore_still_skips_a_downloaded_set_of_the_same_version() -> None:
    """A downloaded set's version does identify its content; it is not merged."""
    manifest = "schema_version: '1.0'\ntitle: Test Set\n"
    store_set(
        _cache_root(), "owner/repo", "fr-a1", "3.0.0",
        manifest_yaml=manifest, lessons={"01.json": "{}", "02.json": "{}"},
    )
    backup = dump_content_sets()
    lessons_dir = cache_path_for_set(_cache_root(), "owner/repo", "fr-a1", "3.0.0") / "lessons"
    (lessons_dir / "02.json").unlink()

    summary = restore_content_sets(backup)

    assert summary == {"restored": 0, "skipped": 1, "errors": []}
    assert sorted(path.name for path in lessons_dir.iterdir()) == ["01.json"]
