"""Tests for app.services.model_discovery (v1.11.0 / Phase 24A).

Covers each provider's happy-path response shape, the model-type
filter (drop embedding / audio / fine-tune), error handling for
auth + network failures, and the 1-hour in-memory cache.
"""

from __future__ import annotations

import httpx
import pytest

from app.exceptions import ExternalServiceError
from app.schemas import AIProvider
from app.services import model_discovery


@pytest.fixture(autouse=True)
def _clear_cache():
    # Cache survives between tests inside the same pytest process.
    # See lessons-learned: "Module-level caches survive test boundaries".
    model_discovery.clear_cache()
    yield
    model_discovery.clear_cache()


def _mock_transport(handler):
    """Wrap a callable into the httpx MockTransport contract."""
    return httpx.MockTransport(handler)


def _patch_httpx_get(monkeypatch, handler):
    """Replace httpx.get with one whose response is built by ``handler``.

    ``handler`` receives ``httpx.Request`` and returns
    ``httpx.Response``.
    """

    def fake_get(url, **kwargs):
        request = httpx.Request("GET", url, **{k: v for k, v in kwargs.items() if k in ("params", "headers")})
        return handler(request)

    monkeypatch.setattr(model_discovery.httpx, "get", fake_get)


# --- Anthropic ----------------------------------------------------------


def test_fetch_anthropic_models_happy_path(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert "x-api-key" in request.headers
        assert request.headers["x-api-key"] == "sk-ant-fake"
        assert request.headers["anthropic-version"] == "2023-06-01"
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": "claude-opus-4-20250514",
                        "display_name": "Claude Opus 4",
                    },
                    {
                        "id": "claude-sonnet-4-20250514",
                        "display_name": "Claude Sonnet 4",
                    },
                ]
            },
        )

    _patch_httpx_get(monkeypatch, handler)
    models = model_discovery.fetch_anthropic_models("sk-ant-fake")
    assert len(models) == 2
    assert models[0].id == "claude-opus-4-20250514"
    assert models[0].name == "Claude Opus 4"
    assert models[0].context_window == 200000


def test_fetch_anthropic_models_empty_key_returns_empty():
    assert model_discovery.fetch_anthropic_models("") == []


def test_fetch_anthropic_models_401_raises(monkeypatch):
    def handler(request):
        return httpx.Response(401, json={"error": {"message": "Invalid key"}})

    _patch_httpx_get(monkeypatch, handler)
    with pytest.raises(ExternalServiceError) as excinfo:
        model_discovery.fetch_anthropic_models("sk-ant-bad")
    assert "anthropic" in str(excinfo.value).lower()


def test_fetch_anthropic_models_500_raises(monkeypatch):
    def handler(request):
        return httpx.Response(500, json={})

    _patch_httpx_get(monkeypatch, handler)
    with pytest.raises(ExternalServiceError):
        model_discovery.fetch_anthropic_models("sk-ant-fake")


def test_fetch_anthropic_models_network_error_raises(monkeypatch):
    def fake_get(url, **kwargs):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(model_discovery.httpx, "get", fake_get)
    with pytest.raises(ExternalServiceError):
        model_discovery.fetch_anthropic_models("sk-ant-fake")


def test_fetch_anthropic_models_uses_cache(monkeypatch):
    calls = {"count": 0}

    def handler(request):
        calls["count"] += 1
        return httpx.Response(200, json={"data": [{"id": "claude-x", "display_name": "Claude X"}]})

    _patch_httpx_get(monkeypatch, handler)
    first = model_discovery.fetch_anthropic_models("sk-ant-fake")
    second = model_discovery.fetch_anthropic_models("sk-ant-fake")
    assert calls["count"] == 1
    assert first == second


# --- OpenAI -------------------------------------------------------------


def test_fetch_openai_models_filters_non_chat(monkeypatch):
    def handler(request):
        assert request.headers["Authorization"] == "Bearer sk-fake"
        return httpx.Response(
            200,
            json={
                "data": [
                    {"id": "gpt-4o"},
                    {"id": "gpt-4o-mini"},
                    {"id": "text-embedding-3-small"},  # filtered
                    {"id": "whisper-1"},  # filtered
                    {"id": "tts-1"},  # filtered
                    {"id": "dall-e-3"},  # filtered
                    {"id": "o1-preview"},
                    {"id": "gpt-3.5-turbo"},
                    {"id": "babbage-002"},  # filtered (deprecated completion)
                    {"id": "text-moderation-stable"},  # filtered
                ]
            },
        )

    _patch_httpx_get(monkeypatch, handler)
    models = model_discovery.fetch_openai_models("sk-fake")
    ids = [m.id for m in models]
    assert "gpt-4o" in ids
    assert "gpt-4o-mini" in ids
    assert "o1-preview" in ids
    assert "gpt-3.5-turbo" in ids
    assert "text-embedding-3-small" not in ids
    assert "whisper-1" not in ids
    assert "tts-1" not in ids
    assert "dall-e-3" not in ids
    assert "babbage-002" not in ids
    assert "text-moderation-stable" not in ids


def test_fetch_openai_models_empty_key():
    assert model_discovery.fetch_openai_models("") == []


def test_fetch_openai_models_401_raises(monkeypatch):
    def handler(request):
        return httpx.Response(401, json={})

    _patch_httpx_get(monkeypatch, handler)
    with pytest.raises(ExternalServiceError):
        model_discovery.fetch_openai_models("sk-bad")


def test_fetch_openai_models_context_window_inference(monkeypatch):
    def handler(request):
        return httpx.Response(200, json={"data": [
            {"id": "gpt-4o-mini"},
            {"id": "gpt-3.5-turbo"},
            {"id": "o1-mini"},
        ]})

    _patch_httpx_get(monkeypatch, handler)
    models = {m.id: m for m in model_discovery.fetch_openai_models("sk-fake")}
    assert models["gpt-4o-mini"].context_window == 128000
    assert models["gpt-3.5-turbo"].context_window == 16384
    assert models["o1-mini"].context_window == 200000


# --- Gemini -------------------------------------------------------------


def test_fetch_gemini_models_happy_path(monkeypatch):
    def handler(request):
        assert request.url.params["key"] == "gemini-fake"
        return httpx.Response(
            200,
            json={
                "models": [
                    {
                        "name": "models/gemini-2.0-flash",
                        "displayName": "Gemini 2.0 Flash",
                        "description": "Fast multimodal model.",
                        "supportedGenerationMethods": ["generateContent", "countTokens"],
                        "inputTokenLimit": 1048576,
                    },
                    {
                        "name": "models/embedding-001",  # filtered
                        "displayName": "Embedding 001",
                        "supportedGenerationMethods": ["embedContent"],
                    },
                    {
                        "name": "models/aqa",  # filtered (excluded substring)
                        "displayName": "AQA",
                        "supportedGenerationMethods": ["generateAnswer"],
                    },
                ]
            },
        )

    _patch_httpx_get(monkeypatch, handler)
    models = model_discovery.fetch_gemini_models("gemini-fake")
    assert len(models) == 1
    assert models[0].id == "gemini-2.0-flash"
    assert models[0].name == "Gemini 2.0 Flash"
    assert models[0].context_window == 1048576
    assert models[0].description == "Fast multimodal model."


def test_fetch_gemini_models_empty_key():
    assert model_discovery.fetch_gemini_models("") == []


def test_fetch_gemini_models_403_raises(monkeypatch):
    def handler(request):
        return httpx.Response(403, json={})

    _patch_httpx_get(monkeypatch, handler)
    with pytest.raises(ExternalServiceError):
        model_discovery.fetch_gemini_models("bad-key")


# --- Dispatcher --------------------------------------------------------


def test_fetch_models_dispatches_by_provider(monkeypatch):
    calls: list[str] = []

    def handler(request):
        url = str(request.url)
        if "anthropic.com" in url:
            calls.append("anthropic")
            return httpx.Response(200, json={"data": []})
        if "openai.com" in url:
            calls.append("openai")
            return httpx.Response(200, json={"data": []})
        if "googleapis.com" in url:
            calls.append("gemini")
            return httpx.Response(200, json={"models": []})
        return httpx.Response(404)

    _patch_httpx_get(monkeypatch, handler)
    model_discovery.fetch_models(AIProvider.ANTHROPIC, "k-a")
    model_discovery.fetch_models(AIProvider.OPENAI, "k-o")
    model_discovery.fetch_models(AIProvider.GEMINI, "k-g")
    assert calls == ["anthropic", "openai", "gemini"]


def test_cache_isolated_per_api_key(monkeypatch):
    calls = {"count": 0}

    def handler(request):
        calls["count"] += 1
        return httpx.Response(200, json={"data": [{"id": "claude-x", "display_name": "X"}]})

    _patch_httpx_get(monkeypatch, handler)
    model_discovery.fetch_anthropic_models("key-a")
    model_discovery.fetch_anthropic_models("key-b")
    assert calls["count"] == 2  # Two distinct keys, two fetches.
    model_discovery.fetch_anthropic_models("key-a")  # cached
    assert calls["count"] == 2
