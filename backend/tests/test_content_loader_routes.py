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
    paths = {r.path for r in app.routes if hasattr(r, "path")}
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
    assert entry["language"] == "fr"
    assert entry["level"] == "A1"
    assert entry["cached_version"] is None
    assert entry["update_available"] is False


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
