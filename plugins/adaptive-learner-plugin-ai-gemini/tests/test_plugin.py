"""Tests for the AiGeminiPlugin class.

End-to-end via the production PluginManager lives in
``backend/tests/test_ai_gemini_plugin_integration.py``. These
tests cover the routing + exception-wrapping the plugin class
owns, without ``app.*`` on sys.path.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from adaptive_learner_ai_gemini import GEMINI_MODEL_PREFIX
from adaptive_learner_ai_gemini.plugin import AiGeminiPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin():
    assert issubclass(AiGeminiPlugin, BasePlugin)


def test_required_class_attrs():
    assert AiGeminiPlugin.name == "ai-gemini"
    assert AiGeminiPlugin.version == "0.1.0"
    assert AiGeminiPlugin.description
    assert AiGeminiPlugin.author


# --- ai_complete routing --------------------------------------------------


@pytest.mark.parametrize(
    "model",
    [
        "claude-sonnet-4-6",
        "gpt-4o",
        "mistral-large",
        "",
        None,
        123,  # non-string defensiveness
    ],
)
def test_ai_complete_returns_none_for_non_gemini_models(model):
    """firstresult dispatch: returning None tells pluggy to try the
    next AI provider plugin. Wrong-model routing must NOT raise."""
    out = AiGeminiPlugin().ai_complete(
        messages=[{"role": "user", "content": "x"}],
        model=model,  # type: ignore[arg-type]
        api_key="k",
    )
    assert out is None


@pytest.mark.parametrize(
    "model",
    [
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        f"{GEMINI_MODEL_PREFIX}-brand-new-model",
    ],
)
def test_ai_complete_dispatches_to_client_for_gemini_models(model):
    with patch("adaptive_learner_ai_gemini.plugin._complete", return_value="hi") as mock_complete:
        out = AiGeminiPlugin().ai_complete(
            messages=[{"role": "user", "content": "x"}],
            model=model,
            api_key="k",
        )
        assert out == "hi"
        mock_complete.assert_called_once()


# --- ai_complete_stream routing (v1.6.0 / Phase 19) ------------------------


@pytest.mark.parametrize(
    "model",
    ["claude-sonnet-4-6", "gpt-4o", "", None, 123],
)
def test_ai_complete_stream_returns_none_for_non_gemini_models(model):
    out = AiGeminiPlugin().ai_complete_stream(
        messages=[{"role": "user", "content": "x"}],
        model=model,  # type: ignore[arg-type]
        api_key="k",
    )
    assert out is None


@pytest.mark.asyncio
async def test_ai_complete_stream_dispatches_async_generator():
    async def fake_stream(messages, model, api_key, **kwargs):  # noqa: ARG001
        yield "Hi"
        yield " gemini"

    with patch("adaptive_learner_ai_gemini.plugin._stream", side_effect=fake_stream):
        gen = AiGeminiPlugin().ai_complete_stream(
            messages=[{"role": "user", "content": "x"}],
            model="gemini-2.0-flash",
            api_key="ak-test",
        )
        assert gen is not None
        chunks = [c async for c in gen]
    assert chunks == ["Hi", " gemini"]


# Empty-api-key + SDK-exception-wrap coverage lives in
# backend/tests/test_ai_gemini_plugin_integration.py — both need
# ``app.exceptions`` on sys.path, which the standalone test dir
# does not provide. Same split as the ai-anthropic plugin.
