"""Tests for the ContentLoaderService orchestrator
(Phase 43 / EXP-002 / 2C-wire).

Hermetic via ``httpx.MockTransport`` + temp cache root. The
integration tests in ``backend/tests/test_content_loader_routes.py``
exercise the FastAPI route layer under TestClient with the
backend on sys.path.
"""

from __future__ import annotations

import json
import textwrap
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from adaptive_learner_content_loader.cache import (
    is_set_cached,
    list_cached_versions,
)
from adaptive_learner_content_loader.exceptions import (
    ContentNotFoundError,
)
from adaptive_learner_content_loader.service import (
    ContentLoaderService,
)
from adaptive_learner_content_loader.sources import (
    SourceRef,
    parse_source_refs_from_settings,
    user_source_from_settings,
    user_sources_from_settings,
)


SOURCE = "astrapi69/adaptive-learner-content"
BRANCH = "main"
SET_ID = "language-fr-a1"

REPO_MANIFEST = textwrap.dedent(
    """
    schema_version: '1.0'
    name: Adaptive Learner Pilot
    sets:
      - id: language-fr-a1
        title: French A1
        language: fr
        level: A1
        version: '1.0.0'
        lesson_count: 2
        domain: language
        tags: [beginner]
    """
).strip()


SET_MANIFEST = textwrap.dedent(
    """
    schema_version: '1.0'
    name: French A1
    sets:
      - id: language-fr-a1
        title: French A1
        language: fr
        level: A1
        version: '1.0.0'
        lesson_count: 2
    metadata:
      lessons:
        - 01-greetings.json
        - 02-numbers.json
    """
).strip()


def _make_lesson(lesson_id: str, title: str) -> str:
    return json.dumps(
        {
            "id": lesson_id,
            "title": title,
            "cards": [
                {"id": "card-1", "front": "Foo", "back": "Bar"},
            ],
            "steps": [
                {
                    "id": "intro",
                    "type": "theory",
                    "body": f"# {title}\n\nIntro text.",
                },
            ],
        },
    )


def _make_mock_transport(
    payloads: dict[str, str | None],
) -> httpx.MockTransport:
    """Build a MockTransport that maps URL path → body.

    A None value returns 404 (so a test can pin "this file is
    missing from the upstream"). Any unmapped path also
    returns 404.
    """

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path in payloads:
            body = payloads[path]
            if body is None:
                return httpx.Response(404, text="not found")
            return httpx.Response(200, text=body)
        return httpx.Response(404, text=f"unmocked: {path}")

    return httpx.MockTransport(handler)


def _install_mock(transport: httpx.MockTransport) -> object:
    """Patch httpx.AsyncClient so the service uses our transport.

    The service creates short-lived clients itself; we need
    them to share the mock transport.
    """
    original = httpx.AsyncClient

    def _factory(*args: object, **kwargs: object) -> httpx.AsyncClient:
        kwargs.pop("transport", None)
        return original(*args, transport=transport, **kwargs)  # type: ignore[arg-type]

    return patch("httpx.AsyncClient", side_effect=_factory)


# --- parse_source_refs_from_settings ----------------------------------


class TestParseSourceRefs:
    def test_empty_input(self) -> None:
        assert parse_source_refs_from_settings(None) == []
        assert parse_source_refs_from_settings([]) == []

    def test_valid_entries(self) -> None:
        refs = parse_source_refs_from_settings(
            [
                {"source": "owner/repo", "branch": "main"},
                {"source": "other/x", "branch": "develop"},
            ],
        )
        assert refs == [
            SourceRef(source="owner/repo", branch="main"),
            SourceRef(source="other/x", branch="develop"),
        ]

    def test_default_branch_when_omitted(self) -> None:
        refs = parse_source_refs_from_settings(
            [{"source": "owner/repo"}],
        )
        assert refs == [SourceRef(source="owner/repo", branch="main")]

    def test_skips_malformed_entries(self) -> None:
        refs = parse_source_refs_from_settings(
            [
                {"source": "owner/repo"},
                {"source": "no-slash"},  # missing slash
                "not-a-dict",
                {"branch": "main"},  # missing source
            ],
        )
        assert refs == [SourceRef(source="owner/repo")]


class TestUserSourceFromSettings:
    """EXP-023 Phase A — the connected user repo joins the sources."""

    def test_none_when_missing_or_not_connected(self) -> None:
        assert user_source_from_settings(None) is None
        assert user_source_from_settings({}) is None
        assert (
            user_source_from_settings(
                {"owner": "jane", "repo": "x", "connected": False},
            )
            is None
        )

    def test_builds_ref_when_connected(self) -> None:
        ref = user_source_from_settings(
            {"owner": "jane", "repo": "x", "branch": "dev", "connected": True},
        )
        assert ref == SourceRef(source="jane/x", branch="dev")

    def test_defaults_branch_to_main(self) -> None:
        ref = user_source_from_settings(
            {"owner": "jane", "repo": "x", "connected": True},
        )
        assert ref == SourceRef(source="jane/x", branch="main")

    def test_none_when_owner_or_repo_missing(self) -> None:
        assert (
            user_source_from_settings({"owner": "jane", "connected": True})
            is None
        )


class TestUserSourcesFromSettings:
    """EXP-023 Phase B — the user_repos list (+ legacy migration)."""

    def test_empty_when_no_keys(self) -> None:
        assert user_sources_from_settings({}) == []

    def test_reads_the_list_in_order_skipping_unconnected(self) -> None:
        refs = user_sources_from_settings(
            {
                "user_repos": [
                    {"owner": "jane", "repo": "a", "connected": True},
                    {"owner": "bob", "repo": "b", "branch": "dev", "connected": True},
                    {"owner": "kim", "repo": "c", "connected": False},
                ],
            },
        )
        assert refs == [
            SourceRef(source="jane/a", branch="main"),
            SourceRef(source="bob/b", branch="dev"),
        ]

    def test_migrates_legacy_single_user_repo(self) -> None:
        refs = user_sources_from_settings(
            {"user_repo": {"owner": "jane", "repo": "legacy", "connected": True}},
        )
        assert refs == [SourceRef(source="jane/legacy", branch="main")]


# --- list_sets --------------------------------------------------------


class TestListSets:
    async def test_lists_upstream_sets(self, tmp_path: Path) -> None:
        transport = _make_mock_transport(
            {
                f"/{SOURCE}/{BRANCH}/manifest.yaml": REPO_MANIFEST,
            },
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            entries = await service.list_sets()
        assert len(entries) == 1
        entry = entries[0]
        assert entry.set.id == SET_ID
        assert entry.cached_version is None
        assert entry.update_available is False

    async def test_marks_update_available_when_upstream_newer(
        self,
        tmp_path: Path,
    ) -> None:
        # Pre-seed an older cached version.
        from adaptive_learner_content_loader.cache import store_set

        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "0.9.0",
            manifest_yaml=REPO_MANIFEST,
            lessons={"01-greetings.json": _make_lesson("01", "G")},
        )

        transport = _make_mock_transport(
            {f"/{SOURCE}/{BRANCH}/manifest.yaml": REPO_MANIFEST},
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            entries = await service.list_sets()
        assert entries[0].cached_version == "0.9.0"
        assert entries[0].update_available is True

    async def test_marks_no_update_when_cache_matches(
        self,
        tmp_path: Path,
    ) -> None:
        from adaptive_learner_content_loader.cache import store_set

        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=REPO_MANIFEST,
            lessons={"01-greetings.json": _make_lesson("01", "G")},
        )
        transport = _make_mock_transport(
            {f"/{SOURCE}/{BRANCH}/manifest.yaml": REPO_MANIFEST},
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            entries = await service.list_sets()
        assert entries[0].cached_version == "1.0.0"
        assert entries[0].update_available is False

    async def test_offline_falls_back_to_cached_sets(
        self,
        tmp_path: Path,
    ) -> None:
        # Pre-seed a cached set, then make the upstream
        # manifest fetch return 404 (simulating offline /
        # missing repo). The service must still surface the
        # cached set so the Set Browser stays usable.
        from adaptive_learner_content_loader.cache import store_set

        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=REPO_MANIFEST,
            lessons={"01-greetings.json": _make_lesson("01", "G")},
        )
        transport = _make_mock_transport(
            {f"/{SOURCE}/{BRANCH}/manifest.yaml": None},
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            entries = await service.list_sets()
        assert len(entries) == 1
        assert entries[0].cached_version == "1.0.0"

    async def test_lists_downloaded_set_from_unconfigured_source(
        self,
        tmp_path: Path,
    ) -> None:
        # A set downloaded from a source NOT in self.sources (the download
        # endpoint accepts any source by slug + default branch) is cached on
        # disk and MUST still appear in "My Content". Before the fix,
        # list_sets only surfaced cache for configured sources, so GET /sets
        # returned [] right after a successful download.
        from adaptive_learner_content_loader.cache import store_set

        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=REPO_MANIFEST,
            lessons={"01-greetings.json": _make_lesson("01", "G")},
        )
        # No configured sources at all -> the upstream loop never runs and no
        # network call is made; the set is surfaced purely from the cache.
        service = ContentLoaderService(cache_root=tmp_path, sources=[])
        entries = await service.list_sets()
        assert len(entries) == 1
        assert entries[0].source == SOURCE
        assert entries[0].set.id == SET_ID
        assert entries[0].cached_version == "1.0.0"


# --- dedupe across sources --------------------------------------------


def _set_entry(source: str, set_id: str, version: str):
    from adaptive_learner_content_loader.models import ContentSet
    from adaptive_learner_content_loader.service import SetEntry

    return SetEntry(
        source=source,
        branch="main",
        set=ContentSet(
            id=set_id,
            title=set_id,
            language="fr",
            level="A1",
            version=version,
            lesson_count=1,
        ),
        cached_version=None,
        update_available=False,
    )


class TestDedupeContentEntries:
    def test_compare_versions(self) -> None:
        from adaptive_learner_content_loader.service import _compare_versions

        assert _compare_versions("1.2.0", "1.1.9") > 0
        assert _compare_versions("1.0.0", "1.0.1") < 0
        assert _compare_versions("1.0.0", "1.0.0") == 0
        assert _compare_versions("1.0", "1.0.0") == 0
        assert _compare_versions("2.0.0", "1.9.9") > 0

    def test_higher_version_wins(self) -> None:
        from adaptive_learner_content_loader.service import (
            _dedupe_content_entries,
        )

        entries = [
            _set_entry("bundled:fr-a1", "language-fr-a1", "1.0.0"),
            _set_entry("astrapi69/adaptive-learner-content", "language-fr-a1", "1.2.0"),
        ]
        result = _dedupe_content_entries(entries)
        assert len(result) == 1
        assert result[0].set.version == "1.2.0"
        assert result[0].source == "astrapi69/adaptive-learner-content"

    def test_tie_prefers_external_over_bundled(self) -> None:
        from adaptive_learner_content_loader.service import (
            _dedupe_content_entries,
        )

        # Bundled listed first (as in DEFAULT order), external second.
        entries = [
            _set_entry("bundled:fr-a1", "language-fr-a1", "1.0.0"),
            _set_entry("astrapi69/adaptive-learner-content", "language-fr-a1", "1.0.0"),
        ]
        result = _dedupe_content_entries(entries)
        assert len(result) == 1
        assert result[0].source == "astrapi69/adaptive-learner-content"

    def test_bundled_only_survives_when_external_absent(self) -> None:
        # Offline fallback: external unreachable, only bundled present.
        from adaptive_learner_content_loader.service import (
            _dedupe_content_entries,
        )

        entries = [_set_entry("bundled:fr-a1", "language-fr-a1", "1.0.0")]
        result = _dedupe_content_entries(entries)
        assert len(result) == 1
        assert result[0].source == "bundled:fr-a1"

    def test_distinct_ids_all_kept(self) -> None:
        from adaptive_learner_content_loader.service import (
            _dedupe_content_entries,
        )

        entries = [
            _set_entry("bundled:fr-a1", "language-fr-a1", "1.0.0"),
            _set_entry("bundled:es-a1", "language-es-a1", "1.0.0"),
        ]
        result = _dedupe_content_entries(entries)
        assert {e.set.id for e in result} == {"language-fr-a1", "language-es-a1"}


# --- download_set -----------------------------------------------------


class TestDownloadSet:
    async def test_full_download(self, tmp_path: Path) -> None:
        transport = _make_mock_transport(
            {
                f"/{SOURCE}/{BRANCH}/manifest.yaml": REPO_MANIFEST,
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/manifest.yaml": SET_MANIFEST,
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/lessons/01-greetings.json": _make_lesson(
                    "01-greetings",
                    "Greetings",
                ),
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/lessons/02-numbers.json": _make_lesson(
                    "02-numbers",
                    "Numbers",
                ),
            },
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            entry = await service.download_set(SOURCE, BRANCH, SET_ID)
        assert entry.cached_version == "1.0.0"
        assert entry.update_available is False
        assert is_set_cached(tmp_path, SOURCE, SET_ID, "1.0.0")
        # Lesson files landed.
        assert sorted(
            service.list_cached_lesson_filenames(SOURCE, SET_ID),
        ) == ["01-greetings.json", "02-numbers.json"]

    async def test_download_honours_path_field(self, tmp_path: Path) -> None:
        # Phase 60: a set declaring ``path: sets/de/fr-a1`` is
        # fetched from that directory, NOT the legacy
        # ``sets/{id}`` convention.
        pair_id = "fr-a1-from-de"
        repo_manifest = textwrap.dedent(
            """
            schema_version: '1.2'
            name: Adaptive Learner Content
            sets:
              - id: fr-a1-from-de
                title: Französisch A1
                target_language: fr
                source_language: de
                level: A1
                path: sets/de/fr-a1
                version: '1.0.0'
                lesson_count: 1
                domain: language
            """
        ).strip()
        set_manifest = textwrap.dedent(
            """
            schema_version: '1.2'
            name: Französisch A1
            sets:
              - id: fr-a1-from-de
                title: Französisch A1
                target_language: fr
                source_language: de
                level: A1
                path: sets/de/fr-a1
                version: '1.0.0'
                lesson_count: 1
            metadata:
              lessons:
                - 01-begruessung.json
            """
        ).strip()
        transport = _make_mock_transport(
            {
                f"/{SOURCE}/{BRANCH}/manifest.yaml": repo_manifest,
                f"/{SOURCE}/{BRANCH}/sets/de/fr-a1/manifest.yaml": set_manifest,
                f"/{SOURCE}/{BRANCH}/sets/de/fr-a1/lessons/01-begruessung.json": _make_lesson(
                    "01-begruessung",
                    "Begrüßung",
                ),
            },
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            entry = await service.download_set(SOURCE, BRANCH, pair_id)
        assert entry.cached_version == "1.0.0"
        assert entry.set.source_language == "de"
        assert is_set_cached(tmp_path, SOURCE, pair_id, "1.0.0")
        assert service.list_cached_lesson_filenames(SOURCE, pair_id) == [
            "01-begruessung.json",
        ]

    async def test_skip_when_cache_matches(self, tmp_path: Path) -> None:
        from adaptive_learner_content_loader.cache import store_set

        store_set(
            tmp_path,
            SOURCE,
            SET_ID,
            "1.0.0",
            manifest_yaml=SET_MANIFEST,
            lessons={"01-greetings.json": _make_lesson("01", "G")},
        )
        # Only the repo manifest is mocked — if the service
        # tries to fetch the set manifest or lessons, we'd
        # get an unmocked-404 surfacing as
        # ContentNotFoundError. The test passing proves
        # nothing was fetched beyond the repo manifest.
        transport = _make_mock_transport(
            {f"/{SOURCE}/{BRANCH}/manifest.yaml": REPO_MANIFEST},
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            entry = await service.download_set(SOURCE, BRANCH, SET_ID)
        assert entry.cached_version == "1.0.0"

    async def test_download_prunes_stale_version_on_update(
        self,
        tmp_path: Path,
    ) -> None:
        """Regression #62: a re-download at a newer content version
        invalidates (prunes) the previously cached version instead of
        letting stale set versions accumulate."""
        v1_transport = _make_mock_transport(
            {
                f"/{SOURCE}/{BRANCH}/manifest.yaml": REPO_MANIFEST,
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/manifest.yaml": SET_MANIFEST,
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/lessons/01-greetings.json": _make_lesson(
                    "01-greetings",
                    "Greetings",
                ),
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/lessons/02-numbers.json": _make_lesson(
                    "02-numbers",
                    "Numbers",
                ),
            },
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(v1_transport):
            await service.download_set(SOURCE, BRANCH, SET_ID)
        assert list_cached_versions(tmp_path, SOURCE, SET_ID) == ["1.0.0"]

        repo_v2 = REPO_MANIFEST.replace("'1.0.0'", "'2.0.0'")
        set_v2 = SET_MANIFEST.replace("'1.0.0'", "'2.0.0'")
        v2_transport = _make_mock_transport(
            {
                f"/{SOURCE}/{BRANCH}/manifest.yaml": repo_v2,
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/manifest.yaml": set_v2,
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/lessons/01-greetings.json": _make_lesson(
                    "01-greetings",
                    "Greetings v2",
                ),
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/lessons/02-numbers.json": _make_lesson(
                    "02-numbers",
                    "Numbers v2",
                ),
            },
        )
        with _install_mock(v2_transport):
            entry = await service.download_set(SOURCE, BRANCH, SET_ID)

        assert entry.cached_version == "2.0.0"
        assert list_cached_versions(tmp_path, SOURCE, SET_ID) == ["2.0.0"]
        assert not is_set_cached(tmp_path, SOURCE, SET_ID, "1.0.0")

    async def test_unknown_set_id_raises_404(
        self,
        tmp_path: Path,
    ) -> None:
        transport = _make_mock_transport(
            {f"/{SOURCE}/{BRANCH}/manifest.yaml": REPO_MANIFEST},
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            with pytest.raises(ContentNotFoundError):
                await service.download_set(SOURCE, BRANCH, "no-such-set")


# --- get_lesson + listing helpers --------------------------------------


class TestLessonRead:
    async def test_get_lesson_returns_cached(self, tmp_path: Path) -> None:
        transport = _make_mock_transport(
            {
                f"/{SOURCE}/{BRANCH}/manifest.yaml": REPO_MANIFEST,
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/manifest.yaml": SET_MANIFEST,
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/lessons/01-greetings.json": _make_lesson(
                    "01-greetings", "Greetings",
                ),
                f"/{SOURCE}/{BRANCH}/sets/{SET_ID}/lessons/02-numbers.json": _make_lesson(
                    "02-numbers", "Numbers",
                ),
            },
        )
        service = ContentLoaderService(
            cache_root=tmp_path,
            sources=[SourceRef(source=SOURCE, branch=BRANCH)],
        )
        with _install_mock(transport):
            await service.download_set(SOURCE, BRANCH, SET_ID)
        lesson = service.get_lesson(
            SOURCE, SET_ID, "01-greetings.json",
        )
        assert lesson.id == "01-greetings"
        assert lesson.title == "Greetings"

    def test_get_lesson_uncached_raises(self, tmp_path: Path) -> None:
        service = ContentLoaderService(cache_root=tmp_path)
        with pytest.raises(ContentNotFoundError):
            service.get_lesson(SOURCE, SET_ID, "01-greetings.json")

    def test_has_cached_set_returns_false_when_empty(
        self,
        tmp_path: Path,
    ) -> None:
        service = ContentLoaderService(cache_root=tmp_path)
        assert service.has_cached_set(SOURCE, SET_ID) is False

    def test_list_cached_lesson_filenames_empty_when_uncached(
        self,
        tmp_path: Path,
    ) -> None:
        service = ContentLoaderService(cache_root=tmp_path)
        assert service.list_cached_lesson_filenames(SOURCE, SET_ID) == []
