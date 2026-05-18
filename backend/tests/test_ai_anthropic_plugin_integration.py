"""Phase 3-B integration test: ai-anthropic under app.main.app.

Exercises the ``firstresult=True`` dispatch path through the
production PluginManager. Anthropic API calls are mocked — no
real network egress.
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
def mocked_anthropic():
    """Patch the Anthropic SDK at the wrapper's import site so the
    real client never instantiates."""
    with patch(
        "adaptive_learner_ai_anthropic.client.anthropic", create=True
    ) as m:
        instance = MagicMock()
        instance.messages.create.return_value = SimpleNamespace(
            content=[SimpleNamespace(text="MOCKED claude reply")]
        )
        m.Anthropic.return_value = instance
        yield m


# --- Plugin wiring ---------------------------------------------------------


def test_plugin_is_active(client: TestClient):
    active = {p.name for p in manager.get_active_plugins()}
    assert "ai-anthropic" in active


def test_no_routes_mounted_by_ai_plugin(client: TestClient):
    """The ai-anthropic plugin is hook-only — it must not mount
    any /api routes. Catches a future regression where someone
    accidentally adds a debug endpoint."""
    paths = {r.path for r in app.routes if hasattr(r, "path")}
    assert not any(
        p.startswith("/api/plugins/ai-anthropic") for p in paths
    )


# --- ai_complete hook through the production manager ----------------------


def test_hook_routes_claude_model_to_anthropic_plugin(
    client: TestClient, mocked_anthropic
):
    """firstresult dispatch: model starts with 'claude-' → plugin
    returns the completion → dispatch stops there."""
    result = manager._pm.hook.ai_complete(
        messages=[{"role": "user", "content": "Hi"}],
        model="claude-sonnet-4-6",
        api_key="sk-test-XYZ",
    )
    assert result == "MOCKED claude reply"
    # Real SDK constructor never touched the wire — the mock did.
    mocked_anthropic.Anthropic.assert_called_once_with(api_key="sk-test-XYZ")


def test_hook_returns_none_for_non_claude_model(
    client: TestClient, mocked_anthropic
):
    """No other AI plugin is registered yet, so a gpt-* model has
    nothing to dispatch to. firstresult returns None."""
    result = manager._pm.hook.ai_complete(
        messages=[{"role": "user", "content": "x"}],
        model="gpt-4o",
        api_key="sk-test",
    )
    assert result is None
    # The wrapper was never reached → the SDK constructor wasn't
    # called.
    mocked_anthropic.Anthropic.assert_not_called()


def test_hook_passes_system_message_to_top_level_kwarg(
    client: TestClient, mocked_anthropic
):
    """End-to-end check that the system / chat split survives the
    hook → plugin → client chain."""
    manager._pm.hook.ai_complete(
        messages=[
            {"role": "system", "content": "Respond in German."},
            {"role": "user", "content": "What is 2+2?"},
        ],
        model="claude-sonnet-4-6",
        api_key="k",
    )
    call_kwargs = mocked_anthropic.Anthropic.return_value.messages.create.call_args.kwargs
    assert call_kwargs["system"] == "Respond in German."
    assert call_kwargs["messages"] == [{"role": "user", "content": "What is 2+2?"}]


def test_empty_api_key_raises_validation_error(client: TestClient):
    """Routing bug or settings UI feeding us an empty key. The
    plugin raises ValidationError synchronously (before any SDK
    call)."""
    with pytest.raises(ValidationError):
        manager._pm.hook.ai_complete(
            messages=[{"role": "user", "content": "x"}],
            model="claude-sonnet-4-6",
            api_key="",
        )


def test_sdk_error_wraps_to_external_service_error(client: TestClient):
    """Any SDK-level exception (auth, rate-limit, network) maps to
    the typed ExternalServiceError so FastAPI returns a stable
    HTTP 502 with detail = 'anthropic: <message>'."""
    with patch(
        "adaptive_learner_ai_anthropic.client.anthropic", create=True
    ) as m:
        instance = MagicMock()
        instance.messages.create.side_effect = RuntimeError("upstream down")
        m.Anthropic.return_value = instance

        with pytest.raises(ExternalServiceError) as exc:
            manager._pm.hook.ai_complete(
                messages=[{"role": "user", "content": "x"}],
                model="claude-sonnet-4-6",
                api_key="sk-test",
            )
    assert "anthropic" in str(exc.value).lower()
    assert "upstream down" in str(exc.value)
