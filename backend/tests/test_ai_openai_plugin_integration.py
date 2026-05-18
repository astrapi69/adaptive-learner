"""Phase 5-C integration test: ai-openai under app.main.app.

Exercises the ``firstresult=True`` dispatch path through the
production PluginManager. OpenAI API calls are mocked — no real
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
def mocked_openai():
    """Patch the OpenAI SDK at the wrapper's import site so the
    real client never instantiates."""
    with patch("adaptive_learner_ai_openai.client.openai", create=True) as m:
        instance = MagicMock()
        instance.chat.completions.create.return_value = SimpleNamespace(
            choices=[
                SimpleNamespace(message=SimpleNamespace(content="MOCKED gpt reply"))
            ]
        )
        m.OpenAI.return_value = instance
        yield m


# --- Plugin wiring ---------------------------------------------------------


def test_plugin_is_active(client: TestClient):
    active = {p.name for p in manager.get_active_plugins()}
    assert "ai-openai" in active


def test_no_routes_mounted_by_ai_plugin(client: TestClient):
    """The ai-openai plugin is hook-only — it must not mount any
    /api routes."""
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert not any(p.startswith("/api/plugins/ai-openai") for p in paths)


# --- ai_complete hook through the production manager ----------------------


def test_hook_routes_gpt_model_to_openai_plugin(client: TestClient, mocked_openai):
    """firstresult dispatch: model starts with 'gpt-' → plugin
    returns the completion → dispatch stops there."""
    result = manager._pm.hook.ai_complete(
        messages=[{"role": "user", "content": "Hi"}],
        model="gpt-4o",
        api_key="sk-test-XYZ",
    )
    assert result == "MOCKED gpt reply"
    mocked_openai.OpenAI.assert_called_once_with(api_key="sk-test-XYZ")


def test_hook_passes_system_message_inline(client: TestClient, mocked_openai):
    """OpenAI keeps role=system inline (unlike Anthropic's
    top-level system kwarg). End-to-end check that the messages
    list survives the hook → plugin → client chain."""
    manager._pm.hook.ai_complete(
        messages=[
            {"role": "system", "content": "Respond in German."},
            {"role": "user", "content": "What is 2+2?"},
        ],
        model="gpt-4o",
        api_key="k",
    )
    call_kwargs = (
        mocked_openai.OpenAI.return_value.chat.completions.create.call_args.kwargs
    )
    assert call_kwargs["messages"] == [
        {"role": "system", "content": "Respond in German."},
        {"role": "user", "content": "What is 2+2?"},
    ]


def test_empty_api_key_raises_validation_error(client: TestClient):
    """Routing bug or settings UI feeding us an empty key. The
    plugin raises ValidationError synchronously (before any SDK
    call)."""
    with pytest.raises(ValidationError):
        manager._pm.hook.ai_complete(
            messages=[{"role": "user", "content": "x"}],
            model="gpt-4o",
            api_key="",
        )


def test_sdk_error_wraps_to_external_service_error(client: TestClient):
    """Any SDK-level exception (auth, rate-limit, network) maps to
    the typed ExternalServiceError so FastAPI returns a stable
    HTTP 502 with detail = 'openai: <message>'."""
    with patch("adaptive_learner_ai_openai.client.openai", create=True) as m:
        instance = MagicMock()
        instance.chat.completions.create.side_effect = RuntimeError("rate limit")
        m.OpenAI.return_value = instance

        with pytest.raises(ExternalServiceError) as exc:
            manager._pm.hook.ai_complete(
                messages=[{"role": "user", "content": "x"}],
                model="gpt-4o",
                api_key="sk-test",
            )
    assert "openai" in str(exc.value).lower()
    assert "rate limit" in str(exc.value)
