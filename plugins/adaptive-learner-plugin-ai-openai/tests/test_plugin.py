"""Tests for the AiOpenAiPlugin class.

End-to-end via the production PluginManager lives in
``backend/tests/test_ai_openai_plugin_integration.py``. These
tests cover the routing + exception-wrapping the plugin class
owns, without ``app.*`` on sys.path.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from adaptive_learner_ai_openai import GPT_MODEL_PREFIX
from adaptive_learner_ai_openai.plugin import AiOpenAiPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin():
    assert issubclass(AiOpenAiPlugin, BasePlugin)


def test_required_class_attrs():
    assert AiOpenAiPlugin.name == "ai-openai"
    assert AiOpenAiPlugin.version == "0.1.0"
    assert AiOpenAiPlugin.description
    assert AiOpenAiPlugin.author


# --- ai_complete routing --------------------------------------------------


@pytest.mark.parametrize(
    "model",
    [
        "claude-sonnet-4-6",
        "gemini-1.5-pro",
        "mistral-large",
        "",
        None,
        123,  # non-string defensiveness
    ],
)
def test_ai_complete_returns_none_for_non_gpt_models(model):
    """firstresult dispatch: returning None tells pluggy to try the
    next AI provider plugin. Wrong-model routing must NOT raise."""
    out = AiOpenAiPlugin().ai_complete(
        messages=[{"role": "user", "content": "x"}],
        model=model,  # type: ignore[arg-type]
        api_key="k",
    )
    assert out is None


@pytest.mark.parametrize(
    "model",
    [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        f"{GPT_MODEL_PREFIX}brand-new-model",
    ],
)
def test_ai_complete_dispatches_to_client_for_gpt_models(model):
    with patch("adaptive_learner_ai_openai.plugin._complete", return_value="hi") as mock_complete:
        out = AiOpenAiPlugin().ai_complete(
            messages=[{"role": "user", "content": "x"}],
            model=model,
            api_key="k",
        )
        assert out == "hi"
        mock_complete.assert_called_once()


# Empty-api-key + SDK-exception-wrap coverage lives in
# backend/tests/test_ai_openai_plugin_integration.py — both need
# ``app.exceptions`` on sys.path, which the standalone test dir
# does not provide. Same split as the ai-anthropic plugin.
