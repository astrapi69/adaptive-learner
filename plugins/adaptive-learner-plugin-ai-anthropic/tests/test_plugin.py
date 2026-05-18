"""Tests for the AiAnthropicPlugin class itself.

End-to-end via the production PluginManager lives in
``backend/tests/test_ai_anthropic_plugin_integration.py`` (the
firstresult dispatch and the ExternalServiceError wrap both need
``app.exceptions`` on sys.path).
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from adaptive_learner_ai_anthropic import CLAUDE_MODEL_PREFIX
from adaptive_learner_ai_anthropic.plugin import AiAnthropicPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin():
    assert issubclass(AiAnthropicPlugin, BasePlugin)


def test_required_class_attrs():
    assert AiAnthropicPlugin.name == "ai-anthropic"
    assert AiAnthropicPlugin.version == "0.1.0"
    assert AiAnthropicPlugin.description
    assert AiAnthropicPlugin.author


# --- ai_complete routing --------------------------------------------------


@pytest.mark.parametrize(
    "model",
    [
        "gpt-4o",
        "gemini-1.5-pro",
        "mistral-large",
        "",
        None,
        123,  # non-string defensiveness
    ],
)
def test_ai_complete_returns_none_for_non_claude_models(model):
    """firstresult dispatch: returning None tells pluggy to try the
    next AI provider plugin. Wrong-model routing must NOT raise."""
    out = AiAnthropicPlugin().ai_complete(
        messages=[{"role": "user", "content": "x"}],
        model=model,  # type: ignore[arg-type]
        api_key="k",
    )
    assert out is None


@pytest.mark.parametrize(
    "model",
    [
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
        "claude-opus-4-7",
        f"{CLAUDE_MODEL_PREFIX}custom",
    ],
)
def test_ai_complete_dispatches_for_claude_models(model):
    with patch("adaptive_learner_ai_anthropic.plugin._complete") as mock_complete:
        mock_complete.return_value = "ok"
        out = AiAnthropicPlugin().ai_complete(
            messages=[{"role": "user", "content": "x"}],
            model=model,
            api_key="sk-test",
        )
    assert out == "ok"
    mock_complete.assert_called_once()
    call_args = mock_complete.call_args
    assert call_args.args[1] == model
    assert call_args.args[2] == "sk-test"
