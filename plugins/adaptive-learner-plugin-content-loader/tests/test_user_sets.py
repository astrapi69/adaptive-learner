"""Tests for user-generated sets — My Lessons (Phase 59B/C / v1.42.0)."""

from __future__ import annotations

from pathlib import Path

import pytest
from adaptive_learner_content_loader.analysis_to_lesson import (
    generate_lesson_from_analysis,
)
from adaptive_learner_content_loader.service import (
    USER_GENERATED_SOURCE,
    USER_SET_VERSION,
    ContentLoaderService,
)
from pydantic import ValidationError

ANALYSIS = {
    "topic": "Spanish travel vocabulary",
    "summary": "Ordering food and asking directions.",
    "vocabulary": [
        {"word": "la cuenta", "translation": "the bill", "example": "La cuenta, por favor."},
        {"word": "el agua", "translation": "the water", "example": "Quiero el agua."},
        {"word": "la calle", "translation": "the street", "example": "La calle esta cerca."},
        {"word": "izquierda", "translation": "left", "example": "Gira a la izquierda."},
        {"word": "gracias", "translation": "thank you"},
    ],
}


def _service(tmp_path: Path) -> ContentLoaderService:
    return ContentLoaderService(cache_root=tmp_path, sources=[])


def _lesson(set_id: str = "conv-1"):
    return generate_lesson_from_analysis(ANALYSIS, lesson_id=set_id)


def test_save_user_set_returns_entry(tmp_path: Path) -> None:
    service = _service(tmp_path)
    lesson = _lesson()
    entry = service.save_user_set(
        set_id="conv-1",
        title="Spanish travel vocabulary",
        target_language="es",
        level="beginner",
        origin="analysis",
        lessons=[lesson],
    )
    assert entry.source == USER_GENERATED_SOURCE
    assert entry.set.id == "conv-1"
    assert entry.set.domain == "analysis"
    assert entry.set.lesson_count == 1
    assert entry.cached_version == USER_SET_VERSION
    # source_language defaults to "en" when not provided.
    assert entry.set.target_language == "es"
    assert entry.set.source_language == "en"


def test_save_user_set_persists_source_language(tmp_path: Path) -> None:
    service = _service(tmp_path)
    entry = service.save_user_set(
        set_id="conv-de",
        title="Französisch A1",
        target_language="fr",
        source_language="de",
        level="A1",
        origin="analysis",
        lessons=[_lesson()],
    )
    assert entry.set.target_language == "fr"
    assert entry.set.source_language == "de"
    # And it survives the manifest YAML serialise/parse round-trip
    # (proves the pair fields are written to the cached manifest).
    from adaptive_learner_content_loader.cache import read_manifest

    manifest = read_manifest(
        service.cache_root, USER_GENERATED_SOURCE, "conv-de", USER_SET_VERSION
    )
    assert manifest.sets[0].target_language == "fr"
    assert manifest.sets[0].source_language == "de"


def test_saved_set_is_listed_and_playable(tmp_path: Path) -> None:
    service = _service(tmp_path)
    lesson = _lesson()
    service.save_user_set(
        set_id="conv-1",
        title="Spanish travel vocabulary",
        target_language="es",
        level="beginner",
        origin="analysis",
        lessons=[lesson],
    )
    # The cached set re-reads as a valid manifest (list path).
    assert service.has_cached_set(USER_GENERATED_SOURCE, "conv-1")
    filenames = service.list_cached_lesson_filenames(USER_GENERATED_SOURCE, "conv-1")
    assert filenames == [f"{lesson.id}.json"]
    # And the lesson re-reads + re-validates as a Lesson.
    loaded = service.get_lesson(USER_GENERATED_SOURCE, "conv-1", f"{lesson.id}.json")
    assert loaded.id == lesson.id
    assert loaded.title == lesson.title
    assert len(loaded.steps) == len(lesson.steps)


def test_save_user_set_persists_book_block(tmp_path: Path) -> None:
    """#1743 — an optional book block is written to ``sets[].book`` and
    survives a re-read from the cached manifest."""
    from adaptive_learner_content_loader.cache import read_manifest
    from adaptive_learner_content_loader.models import ContentSetBook
    from adaptive_learner_content_loader.service import USER_SET_VERSION

    service = _service(tmp_path)
    book = ContentSetBook(
        title="KI fuer Einsteiger",
        author="Asterios Raptis",
        url="https://example.com/ki",
        asin="B0F43H6T2M",
    )
    entry = service.save_user_set(
        set_id="conv-1",
        title="KI fuer Einsteiger",
        target_language="de",
        source_language="de",
        level="A1",
        origin="imported",
        lessons=[_lesson()],
        book=book,
    )
    assert entry.set.book is not None
    assert entry.set.book.title == "KI fuer Einsteiger"

    # Round-trip: re-read the cached manifest from disk.
    manifest = read_manifest(
        tmp_path, USER_GENERATED_SOURCE, "conv-1", USER_SET_VERSION
    )
    assert manifest.sets[0].book is not None
    assert manifest.sets[0].book.title == "KI fuer Einsteiger"
    assert manifest.sets[0].book.asin == "B0F43H6T2M"


def test_save_user_set_without_book_leaves_it_unset(tmp_path: Path) -> None:
    """A save with no book block leaves ``sets[].book`` as ``None``."""
    service = _service(tmp_path)
    entry = service.save_user_set(
        set_id="conv-1",
        title="Spanish travel vocabulary",
        target_language="es",
        level="beginner",
        origin="analysis",
        lessons=[_lesson()],
    )
    assert entry.set.book is None


def test_resave_overwrites_in_place(tmp_path: Path) -> None:
    service = _service(tmp_path)
    service.save_user_set(
        set_id="conv-1",
        title="Old title",
        target_language="es",
        level="beginner",
        origin="analysis",
        lessons=[_lesson()],
    )
    entry = service.save_user_set(
        set_id="conv-1",
        title="New title",
        target_language="es",
        level="beginner",
        origin="analysis",
        lessons=[_lesson()],
    )
    assert entry.set.title == "New title"
    # Exactly one cached version remains (overwrite, not accumulate).
    from adaptive_learner_content_loader.cache import list_cached_versions

    versions = list_cached_versions(tmp_path, USER_GENERATED_SOURCE, "conv-1")
    assert versions == [USER_SET_VERSION]


def test_delete_set_removes_it(tmp_path: Path) -> None:
    service = _service(tmp_path)
    service.save_user_set(
        set_id="conv-1",
        title="t",
        target_language="es",
        level="beginner",
        origin="analysis",
        lessons=[_lesson()],
    )
    assert service.has_cached_set(USER_GENERATED_SOURCE, "conv-1")
    service.delete_set(USER_GENERATED_SOURCE, "conv-1")
    assert not service.has_cached_set(USER_GENERATED_SOURCE, "conv-1")


def test_delete_is_idempotent(tmp_path: Path) -> None:
    service = _service(tmp_path)
    # Deleting a non-existent set does not raise.
    service.delete_set(USER_GENERATED_SOURCE, "nope")


@pytest.mark.asyncio
async def test_list_sets_includes_user_generated(tmp_path: Path) -> None:
    service = _service(tmp_path)
    service.save_user_set(
        set_id="conv-1",
        title="T",
        target_language="es",
        level="beginner",
        origin="analysis",
        lessons=[_lesson()],
    )
    entries = await service.list_sets()
    assert any(e.source == USER_GENERATED_SOURCE and e.set.id == "conv-1" for e in entries)


def test_save_rejects_non_slug_set_id(tmp_path: Path) -> None:
    service = _service(tmp_path)
    with pytest.raises(ValidationError):
        service.save_user_set(
            set_id="Not A Slug",
            title="t",
            target_language="es",
            level="beginner",
            origin="analysis",
            lessons=[_lesson()],
        )
