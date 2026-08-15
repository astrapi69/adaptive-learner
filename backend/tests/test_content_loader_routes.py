"""Phase 43 / EXP-002 commit 6 — content-loader plugin under app.main.

Pins:

1. Plugin mounts under ``/api/plugins/content-loader/*``.
2. GET /sets surfaces an empty list when no sources are
   configured AND no cache exists (cold start in API mode).
3. GET /sets degrades gracefully when the upstream is
   unreachable — surfaces cached sets only.
4. POST /sets/{slug}/{set_id}/download materialises the cache,
   subsequent /sets call returns the new entry as cached.
5. GET /sets/{slug}/{set_id}/lessons 404s on uncached set.
6. GET /sets/{slug}/{set_id}/lessons returns the filename list
   after download.
7. GET /sets/{slug}/{set_id}/lessons/{filename} returns the
   Lesson payload.
8. Unknown source slug → 404 via the wrapped NotFoundError.

All tests use ``httpx.MockTransport`` patched onto
``httpx.AsyncClient`` so zero real network calls fire. The
plugin's filesystem cache lives under the test-isolated
``get_cache_dir()`` (the conftest tmp dir) so the production
marker tripwire stays armed.
"""

from __future__ import annotations

import json
import textwrap
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app, manager
from app.openapi_metadata import iter_api_routes

SOURCE = "astrapi69/adaptive-learner-content"
SOURCE_SLUG = "astrapi69--adaptive-learner-content"
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
        lesson_count: 1
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
        lesson_count: 1
    metadata:
      lessons:
        - 01-greetings.json
    """
).strip()

LESSON_JSON = json.dumps(
    {
        "id": "01-greetings",
        "title": "Greetings",
        "cards": [
            {"id": "bonjour", "front": "Bonjour", "back": "Hello"},
        ],
        "steps": [
            {
                "id": "intro",
                "type": "theory",
                "body": "# Greetings\n\nA few common phrases.",
            },
        ],
    },
)


def _make_mock_transport(
    payloads: dict[str, str | None],
) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path in payloads:
            body = payloads[path]
            if body is None:
                return httpx.Response(404, text="not found")
            return httpx.Response(200, text=body)
        return httpx.Response(404, text=f"unmocked: {path}")

    return httpx.MockTransport(handler)


def _install_mock_transport(transport: httpx.MockTransport):
    original = httpx.AsyncClient

    def _factory(*args, **kwargs):
        kwargs.pop("transport", None)
        return original(*args, transport=transport, **kwargs)

    return patch("httpx.AsyncClient", side_effect=_factory)


@pytest.fixture(autouse=True)
def _clean_cache():
    """Wipe the Content-Loader cache between tests.

    The plugin caches under ``get_cache_dir()/content-loader/``;
    the test conftest sets ADAPTIVE_LEARNER_DATA_DIR to a tmp
    path so the cache lives there for the whole run. Without
    this fixture, downloads from earlier tests would leak into
    later tests' assertions (e.g. ``test_list_lessons_uncached_returns_404``
    would see the set cached by ``test_download_then_list_lessons``).
    """
    import shutil

    from app.paths import get_cache_dir

    cache_dir = get_cache_dir() / "content-loader"
    if cache_dir.exists():
        shutil.rmtree(cache_dir, ignore_errors=True)
    yield


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


# --- Plugin wiring --------------------------------------------------------


def test_plugin_is_active(client: TestClient) -> None:
    active = {p.name for p in manager.get_active_plugins()}
    assert "content-loader" in active


def test_router_paths_mounted(client: TestClient) -> None:
    paths = {r.path for r in iter_api_routes(app)}
    expected = {
        "/api/plugins/content-loader/sets",
        "/api/plugins/content-loader/sets/{source_slug}/{set_id}/download",
        "/api/plugins/content-loader/sets/{source_slug}/{set_id}/lessons",
        "/api/plugins/content-loader/sets/{source_slug}/{set_id}/lessons/{filename}",
    }
    assert expected <= paths


# --- GET /sets ------------------------------------------------------------


def test_list_sets_surfaces_upstream(client: TestClient) -> None:
    transport = _make_mock_transport(
        {f"/{SOURCE}/main/manifest.yaml": REPO_MANIFEST},
    )
    with _install_mock_transport(transport):
        r = client.get("/api/plugins/content-loader/sets")
    assert r.status_code == 200, r.text
    body = r.json()
    sources = {s["source"] for s in body["sources"]}
    assert SOURCE in sources
    matching = [s for s in body["sets"] if s["id"] == SET_ID]
    assert matching, body
    entry = matching[0]
    assert entry["language"] == "fr"  # legacy alias = target
    assert entry["target_language"] == "fr"
    assert entry["source_language"] == "en"  # pilot default
    assert entry["level"] == "A1"
    assert entry["cached_version"] is None
    assert entry["update_available"] is False


def test_list_sets_carries_visibility_flag(client: TestClient) -> None:
    # #1707 — the /sets response passes the manifest ``visibility`` flag
    # straight through (the frontend filters on it, in BOTH storage modes);
    # ``hidden`` is carried, a set without the field defaults to ``visible``.
    manifest = textwrap.dedent(
        f"""
        schema_version: '1.0'
        name: Visibility Test
        sets:
          - id: visible-set
            title: Visible
            language: fr
            level: A1
            version: '1.0.0'
            lesson_count: 1
          - id: graded-quiz-demo-from-de
            title: Graded Quiz Demo
            language: fr
            level: A1
            version: '1.0.0'
            lesson_count: 1
            visibility: hidden
        """
    ).strip()
    transport = _make_mock_transport(
        {f"/{SOURCE}/main/manifest.yaml": manifest},
    )
    with _install_mock_transport(transport):
        r = client.get("/api/plugins/content-loader/sets")
    assert r.status_code == 200, r.text
    by_id = {s["id"]: s for s in r.json()["sets"]}
    assert by_id["visible-set"]["visibility"] == "visible"
    assert by_id["graded-quiz-demo-from-de"]["visibility"] == "hidden"


def test_list_sets_degrades_when_upstream_404(
    client: TestClient,
) -> None:
    # Upstream manifest unreachable. With no cached sets
    # either, the response is still HTTP 200 with an empty
    # "sets" list — the page must not crash on the
    # GH-Pages-first-visit shape.
    transport = _make_mock_transport(
        {f"/{SOURCE}/main/manifest.yaml": None},
    )
    with _install_mock_transport(transport):
        r = client.get("/api/plugins/content-loader/sets")
    assert r.status_code == 200
    assert isinstance(r.json()["sets"], list)


# --- Download + read ------------------------------------------------------


def test_download_then_list_lessons(client: TestClient) -> None:
    transport = _make_mock_transport(
        {
            f"/{SOURCE}/main/manifest.yaml": REPO_MANIFEST,
            f"/{SOURCE}/main/sets/{SET_ID}/manifest.yaml": SET_MANIFEST,
            f"/{SOURCE}/main/sets/{SET_ID}/lessons/01-greetings.json": LESSON_JSON,
        },
    )
    with _install_mock_transport(transport):
        download = client.post(
            f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/download",
        )
    assert download.status_code == 200, download.text
    body = download.json()
    assert body["cached_version"] == "1.0.0"
    assert body["update_available"] is False

    # Lessons listing now resolves from the cache (no
    # network needed).
    r = client.get(
        f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/lessons",
    )
    assert r.status_code == 200, r.text
    listing = r.json()
    assert listing["set_id"] == SET_ID
    assert listing["lessons"] == ["01-greetings.json"]

    # Single-lesson read.
    r = client.get(
        f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/lessons/01-greetings.json",
    )
    assert r.status_code == 200, r.text
    lesson = r.json()
    assert lesson["id"] == "01-greetings"
    assert lesson["title"] == "Greetings"


def test_list_lessons_uncached_returns_404(
    client: TestClient,
) -> None:
    r = client.get(
        f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/lessons",
    )
    assert r.status_code == 404


def test_get_lesson_unknown_returns_404(client: TestClient) -> None:
    # Even with the set cached, an unknown filename → 404.
    transport = _make_mock_transport(
        {
            f"/{SOURCE}/main/manifest.yaml": REPO_MANIFEST,
            f"/{SOURCE}/main/sets/{SET_ID}/manifest.yaml": SET_MANIFEST,
            f"/{SOURCE}/main/sets/{SET_ID}/lessons/01-greetings.json": LESSON_JSON,
        },
    )
    with _install_mock_transport(transport):
        client.post(
            f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/download",
        )
    r = client.get(
        f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/lessons/missing.json",
    )
    assert r.status_code == 404


def test_download_unknown_set_returns_404(client: TestClient) -> None:
    transport = _make_mock_transport(
        {f"/{SOURCE}/main/manifest.yaml": REPO_MANIFEST},
    )
    with _install_mock_transport(transport):
        r = client.post(
            f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/no-such-set/download",
        )
    assert r.status_code == 404


# --- GET /sets/.../assets/{asset_path} (Phase 54F / v1.37.0) -----------


# Repo manifest with one declared asset that the mock
# transport will serve.
REPO_MANIFEST_WITH_ASSETS = textwrap.dedent(
    """
    schema_version: '1.0'
    name: Adaptive Learner Pilot
    sets:
      - id: language-fr-a1
        title: French A1
        language: fr
        level: A1
        version: '1.0.0'
        lesson_count: 1
        domain: language
        tags: [beginner]
        assets:
          - path: img/cover.png
            size_kb: 1
    """,
).strip()


# A tiny binary payload that's safe to mock as raw bytes
# through the existing string-shaped transport (Phase 54F
# only needs to verify the proxy path; the fetch_bytes path
# is exercised by the service tests).
FAKE_PNG = b"\x89PNG\r\n\x1a\n" + b"FAKE_PIXEL_DATA"


def test_asset_route_mounted(client: TestClient) -> None:
    paths = {r.path for r in iter_api_routes(app)}
    assert (
        "/api/plugins/content-loader/sets/{source_slug}/{set_id}/assets/{asset_path:path}" in paths
    )


def test_get_asset_uncached_set_returns_404(client: TestClient) -> None:
    # Without ever calling /download, no version is cached.
    r = client.get(
        f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/assets/img/cover.png",
    )
    assert r.status_code == 404


def test_get_asset_after_download(client: TestClient) -> None:
    """End-to-end: download a set that declares an asset, then
    hit the proxy endpoint and verify the bytes + headers."""

    # Mock both the manifest fetch + the asset fetch via the
    # shared transport.
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        text_routes = {
            f"/{SOURCE}/main/manifest.yaml": REPO_MANIFEST_WITH_ASSETS,
            f"/{SOURCE}/main/sets/{SET_ID}/manifest.yaml": SET_MANIFEST,
            f"/{SOURCE}/main/sets/{SET_ID}/lessons/01-greetings.json": (LESSON_JSON),
        }
        binary_routes = {
            f"/{SOURCE}/main/sets/{SET_ID}/assets/img/cover.png": FAKE_PNG,
        }
        if path in text_routes:
            return httpx.Response(200, text=text_routes[path])
        if path in binary_routes:
            return httpx.Response(200, content=binary_routes[path])
        return httpx.Response(404, text=f"unmocked: {path}")

    with _install_mock_transport(httpx.MockTransport(handler)):
        download = client.post(
            f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/download",
        )
    assert download.status_code == 200, download.text

    # Proxy fetch — works without any further network calls.
    r = client.get(
        f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/assets/img/cover.png",
    )
    assert r.status_code == 200
    assert r.content == FAKE_PNG
    assert r.headers["content-type"].startswith("image/png")
    # Versioned cache layout → immutable browser caching.
    assert "immutable" in r.headers.get("cache-control", "")


def test_get_asset_unknown_path_returns_404(
    client: TestClient,
) -> None:
    """Set IS cached, but the requested asset path was never
    bundled — 404 (not 500). The frontend's resolver treats
    this identically to a Dexie miss → placeholder SVG."""

    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        text_routes = {
            f"/{SOURCE}/main/manifest.yaml": REPO_MANIFEST,
            f"/{SOURCE}/main/sets/{SET_ID}/manifest.yaml": SET_MANIFEST,
            f"/{SOURCE}/main/sets/{SET_ID}/lessons/01-greetings.json": (LESSON_JSON),
        }
        if path in text_routes:
            return httpx.Response(200, text=text_routes[path])
        return httpx.Response(404, text=f"unmocked: {path}")

    with _install_mock_transport(httpx.MockTransport(handler)):
        client.post(
            f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/download",
        )
    r = client.get(
        f"/api/plugins/content-loader/sets/{SOURCE_SLUG}/{SET_ID}/assets/img/missing.png",
    )
    assert r.status_code == 404


# --- Phase 59B/C / v1.42.0 — user-generated sets (My Lessons) --------------


def _user_lesson_payload(set_id: str = "conv-route") -> dict:
    """Build a schema-valid lesson dict via the generator."""
    from adaptive_learner_content_loader.analysis_to_lesson import (
        generate_lesson_from_analysis,
    )

    lesson = generate_lesson_from_analysis(
        {
            "topic": "Route test",
            "summary": "x",
            "vocabulary": [
                {"word": "a", "translation": "b", "example": "a c"},
                {"word": "d", "translation": "e", "example": "d f"},
                {"word": "g", "translation": "h"},
                {"word": "i", "translation": "j"},
            ],
        },
        lesson_id=set_id,
    )
    return lesson.model_dump(mode="json")


def test_save_user_set_then_list_play_delete(client: TestClient) -> None:
    lesson = _user_lesson_payload()
    body = {
        "set_id": "conv-route",
        "title": "Route test",
        "language": "en",
        "level": "beginner",
        "origin": "analysis",
        "lessons": [lesson],
    }
    r = client.post("/api/plugins/content-loader/user-sets", json=body)
    assert r.status_code == 200, r.text
    entry = r.json()
    assert entry["source"] == "user-generated"
    assert entry["id"] == "conv-route"
    assert entry["domain"] == "analysis"

    # Appears in /sets under the user-generated source.
    r = client.get("/api/plugins/content-loader/sets")
    assert any(
        s["id"] == "conv-route" and s["source"] == "user-generated" for s in r.json()["sets"]
    ), r.text

    # Lessons listable + playable (re-validates as Lesson).
    r = client.get(
        "/api/plugins/content-loader/sets/user-generated/conv-route/lessons",
    )
    assert r.status_code == 200, r.text
    filenames = r.json()["lessons"]
    assert filenames, r.text
    r = client.get(
        f"/api/plugins/content-loader/sets/user-generated/conv-route/lessons/{filenames[0]}",
    )
    assert r.status_code == 200, r.text
    assert r.json()["id"] == lesson["id"]

    # Delete removes it.
    r = client.delete("/api/plugins/content-loader/sets/user-generated/conv-route")
    assert r.status_code == 204, r.text
    r = client.get(
        "/api/plugins/content-loader/sets/user-generated/conv-route/lessons",
    )
    assert r.status_code == 404


def test_save_user_set_with_language_pair(client: TestClient) -> None:
    lesson = _user_lesson_payload("conv-de")
    body = {
        "set_id": "conv-de",
        "title": "Französisch A1",
        "target_language": "fr",
        "source_language": "de",
        "level": "A1",
        "origin": "analysis",
        "lessons": [lesson],
    }
    r = client.post("/api/plugins/content-loader/user-sets", json=body)
    assert r.status_code == 200, r.text
    entry = r.json()
    assert entry["target_language"] == "fr"
    assert entry["source_language"] == "de"
    assert entry["language"] == "fr"  # legacy alias mirrors target


def test_save_user_set_with_book_block(client: TestClient) -> None:
    """#1743 — the optional book block round-trips through the route into
    the response's ``book`` field."""
    lesson = _user_lesson_payload("conv-book")
    body = {
        "set_id": "conv-book",
        "title": "KI fuer Einsteiger",
        "target_language": "de",
        "source_language": "de",
        "level": "A1",
        "origin": "imported",
        "book": {
            "title": "KI fuer Einsteiger",
            "author": "Asterios Raptis",
            "asin": "B0F43H6T2M",
        },
        "lessons": [lesson],
    }
    r = client.post("/api/plugins/content-loader/user-sets", json=body)
    assert r.status_code == 200, r.text
    entry = r.json()
    assert entry["book"] is not None
    assert entry["book"]["title"] == "KI fuer Einsteiger"
    assert entry["book"]["asin"] == "B0F43H6T2M"


def test_save_user_set_rejects_bad_set_id(client: TestClient) -> None:
    body = {
        "set_id": "Not A Slug",
        "title": "t",
        "language": "en",
        "level": "beginner",
        "origin": "analysis",
        "lessons": [_user_lesson_payload("conv-x")],
    }
    r = client.post("/api/plugins/content-loader/user-sets", json=body)
    assert r.status_code in (400, 422), r.text
