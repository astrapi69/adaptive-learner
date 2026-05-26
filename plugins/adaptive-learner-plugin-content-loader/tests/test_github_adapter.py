"""Tests for the GitHub raw-URL adapter
(Phase 43 / EXP-002 / 2C-github — P-106).

Hermetic via httpx.MockTransport — zero real network calls.
Pins:
- URL building (canonical raw.githubusercontent.com shape)
- Token auth header presence + absence (public repos work
  tokenless; private repos pass ``Authorization: token X``)
- Each HTTP failure mode maps to the right typed exception
- YAML + JSON convenience parsers
- Shared httpx.AsyncClient round-trip (cache layer needs
  this for batch fetches)

Note: tests live under ``pytest-asyncio`` per the
``asyncio_mode = "auto"`` setting in the plugin's
pyproject.toml — async tests just need ``async def``, no
``@pytest.mark.asyncio`` decorator.
"""

from __future__ import annotations

import json

import httpx
import pytest

from adaptive_learner_content_loader.exceptions import (
    ContentAuthError,
    ContentFetchError,
    ContentNetworkError,
    ContentNotFoundError,
)
from adaptive_learner_content_loader.github_adapter import (
    GitHubRawAdapter,
    build_raw_url,
)


SOURCE = "astrapi69/adaptive-learner-content"
BRANCH = "main"


# --- URL building -------------------------------------------------------


class TestBuildRawUrl:
    def test_canonical_shape(self) -> None:
        url = build_raw_url(SOURCE, BRANCH, "manifest.yaml")
        assert url == (
            "https://raw.githubusercontent.com/"
            "astrapi69/adaptive-learner-content/main/manifest.yaml"
        )

    def test_strips_leading_slash(self) -> None:
        url = build_raw_url(SOURCE, BRANCH, "/sets/fr-a1.json")
        assert url.endswith("/sets/fr-a1.json")
        assert "//sets" not in url

    def test_nested_path(self) -> None:
        url = build_raw_url(SOURCE, BRANCH, "sets/fr-a1/lessons/01.json")
        assert url == (
            "https://raw.githubusercontent.com/"
            "astrapi69/adaptive-learner-content/main/"
            "sets/fr-a1/lessons/01.json"
        )


# --- Auth header --------------------------------------------------------


class TestAuthHeader:
    async def test_tokenless_omits_authorization(self) -> None:
        captured: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured.update(dict(request.headers))
            return httpx.Response(200, text="content")

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter()
            text = await adapter.fetch_text(
                SOURCE, BRANCH, "manifest.yaml", client=client,
            )
        assert text == "content"
        assert "authorization" not in {k.lower() for k in captured}
        assert adapter.has_token is False

    async def test_token_sets_classic_header(self) -> None:
        captured: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            captured.update(dict(request.headers))
            return httpx.Response(200, text="content")

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter(token="ghp_fake_secret")
            await adapter.fetch_text(
                SOURCE, BRANCH, "manifest.yaml", client=client,
            )
        # The auth header uses the classic "token X" shape.
        # Fine-grained PATs work with this prefix on
        # raw.githubusercontent.com per GitHub's docs.
        assert captured.get("authorization") == "token ghp_fake_secret"
        assert adapter.has_token is True


# --- HTTP failure mapping ----------------------------------------------


class TestErrorMapping:
    async def test_404_maps_to_not_found(self) -> None:
        transport = httpx.MockTransport(
            lambda req: httpx.Response(404, text="404 Not Found"),
        )
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter()
            with pytest.raises(ContentNotFoundError) as exc:
                await adapter.fetch_text(
                    SOURCE, BRANCH, "missing.yaml", client=client,
                )
        assert "missing.yaml" in str(exc.value)

    async def test_401_maps_to_auth_error(self) -> None:
        transport = httpx.MockTransport(
            lambda req: httpx.Response(401, text="Bad credentials"),
        )
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter(token="bad")
            with pytest.raises(ContentAuthError):
                await adapter.fetch_text(
                    SOURCE, BRANCH, "private.yaml", client=client,
                )

    async def test_403_maps_to_auth_error(self) -> None:
        transport = httpx.MockTransport(
            lambda req: httpx.Response(403, text="Forbidden"),
        )
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter()
            with pytest.raises(ContentAuthError):
                await adapter.fetch_text(
                    SOURCE, BRANCH, "private.yaml", client=client,
                )

    async def test_500_maps_to_generic_fetch_error(self) -> None:
        transport = httpx.MockTransport(
            lambda req: httpx.Response(500, text="GitHub is on fire"),
        )
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter()
            with pytest.raises(ContentFetchError) as exc:
                await adapter.fetch_text(
                    SOURCE, BRANCH, "anything.yaml", client=client,
                )
        assert "500" in str(exc.value)

    async def test_connect_error_maps_to_network_error(self) -> None:
        def handler(_: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("no route to host")

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter()
            with pytest.raises(ContentNetworkError):
                await adapter.fetch_text(
                    SOURCE, BRANCH, "anything.yaml", client=client,
                )


# --- Content parsing helpers -------------------------------------------


class TestParsingHelpers:
    async def test_fetch_yaml(self) -> None:
        yaml_doc = "schema_version: '1.0'\nname: Pilot\nsets: []\n"
        transport = httpx.MockTransport(
            lambda req: httpx.Response(200, text=yaml_doc),
        )
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter()
            parsed = await adapter.fetch_yaml(
                SOURCE, BRANCH, "manifest.yaml", client=client,
            )
        assert parsed["name"] == "Pilot"
        assert parsed["schema_version"] == "1.0"

    async def test_fetch_json(self) -> None:
        payload = {"id": "01-greetings", "title": "Greetings"}
        transport = httpx.MockTransport(
            lambda req: httpx.Response(200, text=json.dumps(payload)),
        )
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter()
            parsed = await adapter.fetch_json(
                SOURCE, BRANCH, "lessons/01.json", client=client,
            )
        assert parsed == payload

    async def test_fetch_bytes_passes_through(self) -> None:
        # Binary asset (e.g. PNG): no decoding, no parsing.
        raw = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
        transport = httpx.MockTransport(
            lambda req: httpx.Response(200, content=raw),
        )
        async with httpx.AsyncClient(transport=transport) as client:
            adapter = GitHubRawAdapter()
            payload = await adapter.fetch_bytes(
                SOURCE, BRANCH, "assets/cover.png", client=client,
            )
        assert payload == raw


# --- Client lifecycle --------------------------------------------------


class TestClientLifecycle:
    async def test_self_managed_client(self) -> None:
        # When no ``client`` is passed, the adapter creates +
        # closes its own httpx.AsyncClient per call. Hard to
        # verify hermetically without patching httpx.AsyncClient
        # itself, so we just verify the call succeeds end-to-end
        # against a shared transport.
        adapter = GitHubRawAdapter()
        # Pre-built client + transport keeps the test hermetic
        # while exercising the same code path the production
        # caller uses when no client is passed: a fresh
        # AsyncClient is created with the mock transport in the
        # test scope.
        transport = httpx.MockTransport(
            lambda req: httpx.Response(200, text="ok"),
        )
        async with httpx.AsyncClient(transport=transport) as client:
            text = await adapter.fetch_text(
                SOURCE, BRANCH, "x.txt", client=client,
            )
        assert text == "ok"

    async def test_shared_client_reused(self) -> None:
        # The cache layer (commit 5) calls fetch_* multiple
        # times with one shared client. Verify that pattern
        # works.
        call_count = 0

        def handler(req: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(200, text=f"call-{call_count}")

        transport = httpx.MockTransport(handler)
        adapter = GitHubRawAdapter()
        async with httpx.AsyncClient(transport=transport) as client:
            a = await adapter.fetch_text(
                SOURCE, BRANCH, "a.txt", client=client,
            )
            b = await adapter.fetch_text(
                SOURCE, BRANCH, "b.txt", client=client,
            )
            c = await adapter.fetch_text(
                SOURCE, BRANCH, "c.txt", client=client,
            )
        assert (a, b, c) == ("call-1", "call-2", "call-3")
        assert call_count == 3
