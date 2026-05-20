"""Integration test: ai-gemini under app.main.app.

Phase 5-C shipped the first cut against the deprecated
``google.generativeai`` SDK; Phase 6-E migrated to
``google.genai`` 2.x. This file follows the new SDK shape
(``genai.Client(api_key).models.generate_content(...)`` instead
of ``genai.configure`` + ``genai.GenerativeModel``).

Exercises the ``firstresult=True`` dispatch path through the
production PluginManager. Gemini API calls are mocked — no real
network egress.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.exceptions import ExternalServiceError, ValidationError
from app.main import app, manager


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def mocked_gemini():
    """Patch the Gemini SDK at the wrapper's import site so the
    real client never instantiates. The 2.x SDK's surface is
    ``genai.Client(api_key=...).models.generate_content(...)``."""
    with (
        patch("adaptive_learner_ai_gemini.client.genai", create=True) as m,
        patch("adaptive_learner_ai_gemini.client.genai_types", create=True) as types_m,
    ):
        client_instance = MagicMock()
        client_instance.models.generate_content.return_value = SimpleNamespace(
            text="MOCKED gemini reply"
        )
        m.Client.return_value = client_instance
        types_m.GenerateContentConfig.side_effect = lambda **kwargs: SimpleNamespace(**kwargs)
        yield m, types_m


# --- Plugin wiring ---------------------------------------------------------


def test_plugin_is_active(client: TestClient):
    active = {p.name for p in manager.get_active_plugins()}
    assert "ai-gemini" in active


def test_no_routes_mounted_by_ai_plugin(client: TestClient):
    """The ai-gemini plugin is hook-only — it must not mount any
    /api routes."""
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert not any(p.startswith("/api/plugins/ai-gemini") for p in paths)


# --- ai_complete hook through the production manager ----------------------


def test_hook_routes_gemini_model_to_gemini_plugin(client: TestClient, mocked_gemini):
    """firstresult dispatch: model starts with 'gemini-' → plugin
    returns the completion → dispatch stops there."""
    genai_m, _ = mocked_gemini
    result = manager._pm.hook.ai_complete(
        messages=[{"role": "user", "content": "Hi"}],
        model="gemini-2.0-flash",
        api_key="ak-test-XYZ",
    )
    assert result == "MOCKED gemini reply"
    # api_key now flows through Client(api_key=...) instead of
    # genai.configure(api_key=...).
    genai_m.Client.assert_called_once_with(api_key="ak-test-XYZ")


def test_hook_lifts_system_into_config(client: TestClient, mocked_gemini):
    """v0.2.0 lifted system messages into the GenerativeModel
    constructor; v0.3.0 lifts them into the per-call
    GenerateContentConfig.system_instruction field. End-to-end
    check that the transform survives hook → plugin → client."""
    genai_m, types_m = mocked_gemini
    manager._pm.hook.ai_complete(
        messages=[
            {"role": "system", "content": "Respond in German."},
            {"role": "user", "content": "What is 2+2?"},
        ],
        model="gemini-2.0-flash",
        api_key="k",
    )
    config_kwargs = types_m.GenerateContentConfig.call_args.kwargs
    assert config_kwargs["system_instruction"] == "Respond in German."
    # Assistant role translated to model role, system message
    # popped out, content wrapped in {"text": ...} per the new
    # SDK's part schema.
    gc_kwargs = genai_m.Client.return_value.models.generate_content.call_args.kwargs
    assert gc_kwargs["contents"] == [{"role": "user", "parts": [{"text": "What is 2+2?"}]}]


def test_hook_translates_assistant_role_to_model(client: TestClient, mocked_gemini):
    """End-to-end check that the user/assistant -> user/model role
    translation lands in the SDK call."""
    genai_m, _ = mocked_gemini
    manager._pm.hook.ai_complete(
        messages=[
            {"role": "user", "content": "Q1"},
            {"role": "assistant", "content": "A1"},
            {"role": "user", "content": "Q2"},
        ],
        model="gemini-2.0-flash",
        api_key="k",
    )
    gc_kwargs = genai_m.Client.return_value.models.generate_content.call_args.kwargs
    assert gc_kwargs["contents"] == [
        {"role": "user", "parts": [{"text": "Q1"}]},
        {"role": "model", "parts": [{"text": "A1"}]},
        {"role": "user", "parts": [{"text": "Q2"}]},
    ]


def test_empty_api_key_raises_validation_error(client: TestClient):
    with pytest.raises(ValidationError):
        manager._pm.hook.ai_complete(
            messages=[{"role": "user", "content": "x"}],
            model="gemini-2.0-flash",
            api_key="",
        )


def test_sdk_error_wraps_to_external_service_error(client: TestClient):
    """Any SDK-level exception maps to ExternalServiceError so
    FastAPI returns a stable HTTP 502 with detail = 'gemini:
    <message>'."""
    with (
        patch("adaptive_learner_ai_gemini.client.genai", create=True) as m,
        patch("adaptive_learner_ai_gemini.client.genai_types", create=True) as types_m,
    ):
        client_instance = MagicMock()
        client_instance.models.generate_content.side_effect = RuntimeError("safety filter")
        m.Client.return_value = client_instance
        types_m.GenerateContentConfig.side_effect = lambda **kwargs: SimpleNamespace(**kwargs)

        with pytest.raises(ExternalServiceError) as exc:
            manager._pm.hook.ai_complete(
                messages=[{"role": "user", "content": "x"}],
                model="gemini-2.0-flash",
                api_key="ak-test",
            )
    assert "gemini" in str(exc.value).lower()
    assert "safety filter" in str(exc.value)


# --- ai_complete_stream (v1.6.0 / Phase 19) --------------------------------


def test_stream_hook_returns_none_for_non_gemini_model(client: TestClient):
    result = manager._pm.hook.ai_complete_stream(
        messages=[{"role": "user", "content": "x"}],
        model="mistral-large",
        api_key="k",
    )
    assert result is None


def test_stream_hook_rejects_empty_api_key(client: TestClient):
    with pytest.raises(ValidationError):
        manager._pm.hook.ai_complete_stream(
            messages=[{"role": "user", "content": "x"}],
            model="gemini-2.0-flash",
            api_key="",
        )


@pytest.mark.asyncio
async def test_stream_hook_dispatches_gemini_to_async_generator(
    client: TestClient,
):
    async def fake_stream(messages, model, api_key, **kwargs):  # noqa: ARG001
        for delta in ["Hi", " gem"]:
            yield delta

    with patch("adaptive_learner_ai_gemini.plugin._stream", side_effect=fake_stream):
        gen = manager._pm.hook.ai_complete_stream(
            messages=[{"role": "user", "content": "x"}],
            model="gemini-2.0-flash",
            api_key="ak-test",
        )
        assert gen is not None
        chunks = [c async for c in gen]
    assert chunks == ["Hi", " gem"]


@pytest.mark.asyncio
async def test_stream_hook_wraps_sdk_error_as_external_service_error(
    client: TestClient,
):
    async def angry_stream(messages, model, api_key, **kwargs):  # noqa: ARG001
        raise RuntimeError("gemini fell over")
        yield  # pragma: no cover

    with patch("adaptive_learner_ai_gemini.plugin._stream", side_effect=angry_stream):
        gen = manager._pm.hook.ai_complete_stream(
            messages=[{"role": "user", "content": "x"}],
            model="gemini-2.0-flash",
            api_key="ak-test",
        )
        assert gen is not None
        with pytest.raises(ExternalServiceError) as exc:
            async for _ in gen:
                pass
    assert "gemini fell over" in str(exc.value)
