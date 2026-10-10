"""A cached set keeps the fields its root entry owns (#3722, engine#246).

``download_set`` took the set entry from the root manifest but cached the
set's own manifest unchanged, and the offline listing reads only the cache.
Since the content repositories keep ``description`` in the root entry alone
(47 of 53 sets, measured 2026-10-10), an API-mode user offline saw no
description. The fix resolves the set entry at download time the way
learn-content-engine ``resolveSetEntry`` (0.38.0) does.
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest
from adaptive_learner_content_loader.service import ContentLoaderService
from adaptive_learner_content_loader.set_entry_resolution import (
    ROOT_OWNED_SET_FIELDS,
    resolve_set_entry,
)
from adaptive_learner_content_loader.sources import SourceRef

from .test_service import BRANCH, SOURCE, _install_mock, _make_lesson, _make_mock_transport

ROOT = {
    "id": "fr-a1",
    "title": "Französisch A1 (für Deutschsprachige)",
    "description": "Der lange Katalogtext.",
    "visibility": "hidden",
    "review_status": "generated",
    "target_language": "fr",
    "level": "A1",
    "version": "1.0.0",
    "lesson_count": 1,
    "tags": ["beginner"],
}


def test_root_owned_fields_match_the_engine() -> None:
    assert ROOT_OWNED_SET_FIELDS == ("title", "description", "visibility", "review_status")


def test_a_root_owned_field_comes_from_the_root_entry() -> None:
    local = {**ROOT, "title": "Französisch A1 - Anfänger", "description": "Kurz."}
    resolved = resolve_set_entry(ROOT, local)
    assert resolved["title"] == ROOT["title"]
    assert resolved["description"] == ROOT["description"]


def test_any_other_field_comes_from_the_set_manifest() -> None:
    local = {**ROOT, "lesson_count": 2, "tags": ["beginner", "travel"]}
    resolved = resolve_set_entry(ROOT, local)
    assert (resolved["lesson_count"], resolved["tags"]) == (2, ["beginner", "travel"])


@pytest.mark.parametrize("silent", [None, "absent"], ids=["null", "absent"])
def test_a_field_one_entry_leaves_silent_comes_from_the_other(silent: str | None) -> None:
    root = {k: v for k, v in ROOT.items() if k != "description"}
    local = {"id": "fr-a1", "description": "Nur in der Set-Datei.", "lesson_count": 1}
    if silent is None:
        root["description"] = None
        local["tags"] = None
    resolved = resolve_set_entry(root, local)
    assert resolved["description"] == "Nur in der Set-Datei."
    assert resolved["tags"] == ["beginner"]


def test_two_different_sets_are_refused() -> None:
    with pytest.raises(ValueError, match="fr-a1.*es-a1"):
        resolve_set_entry(ROOT, {**ROOT, "id": "es-a1"})


def test_neither_input_is_changed() -> None:
    local = {"id": "fr-a1", "lesson_count": 1}
    before_root, before_local = dict(ROOT), dict(local)
    resolve_set_entry(ROOT, local)
    assert (ROOT, local) == (before_root, before_local)


async def test_a_set_listed_offline_keeps_what_its_root_entry_owns(tmp_path: Path) -> None:
    """Reproduction of #3722 on the real download and offline-listing path."""
    root_manifest = textwrap.dedent(
        """
        schema_version: '1.2'
        name: Content
        sets:
          - id: fr-a1
            title: Französisch A1 (für Deutschsprachige)
            description: Der lange Katalogtext.
            visibility: hidden
            review_status: generated
            target_language: fr
            source_language: de
            level: A1
            path: sets/de/fr-a1
            version: '1.0.0'
            lesson_count: 1
        """
    ).strip()
    set_manifest = textwrap.dedent(
        """
        schema_version: '1.2'
        name: Französisch A1
        sets:
          - id: fr-a1
            title: Französisch A1 (für Deutschsprachige)
            target_language: fr
            source_language: de
            level: A1
            path: sets/de/fr-a1
            version: '1.0.0'
            lesson_count: 1
        metadata:
          lessons:
            - 01-hallo.json
        """
    ).strip()
    online = _make_mock_transport(
        {
            f"/{SOURCE}/{BRANCH}/manifest.yaml": root_manifest,
            f"/{SOURCE}/{BRANCH}/sets/de/fr-a1/manifest.yaml": set_manifest,
            f"/{SOURCE}/{BRANCH}/sets/de/fr-a1/lessons/01-hallo.json": _make_lesson(
                "01-hallo", "Hallo"
            ),
        }
    )
    service = ContentLoaderService(
        cache_root=tmp_path, sources=[SourceRef(source=SOURCE, branch=BRANCH)]
    )
    with _install_mock(online):
        await service.download_set(SOURCE, BRANCH, "fr-a1")

    offline = _make_mock_transport({f"/{SOURCE}/{BRANCH}/manifest.yaml": None})
    with _install_mock(offline):
        [entry] = await service.list_sets()
    assert entry.set.description == "Der lange Katalogtext."
    assert entry.set.visibility.value == "hidden"
    assert entry.set.review_status is not None and entry.set.review_status.value == "generated"
    assert service.list_cached_lesson_filenames(SOURCE, "fr-a1") == ["01-hallo.json"]
