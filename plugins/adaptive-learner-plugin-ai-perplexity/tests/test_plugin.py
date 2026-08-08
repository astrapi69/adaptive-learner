"""Tests for the AiPerplexityPlugin class.

Covers the routing + exception-wrapping the plugin class owns,
without ``app.*`` on sys.path (mirrors the ai-openai plugin tests).
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from adaptive_learner_ai_perplexity import SONAR_MODEL_PREFIX
from adaptive_learner_ai_perplexity.plugin import AiPerplexityPlugin
from pluginforge import BasePlugin


def test_inherits_from_baseplugin():
    assert issubclass(AiPerplexityPlugin, BasePlugin)


def test_required_class_attrs():
    assert AiPerplexityPlugin.name == "ai-perplexity"
    assert AiPerplexityPlugin.version == "0.1.0"
    assert AiPerplexityPlugin.target_application == "adaptive_learner"
    assert AiPerplexityPlugin.description
    assert AiPerplexityPlugin.author


@pytest.mark.parametrize(
    "model",
    [
        "claude-sonnet-4-6",
        "gpt-4o-mini",
        "gemini-1.5-pro",
        "",
        None,
        123,  # non-string defensiveness
    ],
)
def test_ai_complete_returns_none_for_non_sonar_models(model):
    """firstresult dispatch: returning None tells pluggy to try the
    next AI provider plugin. Wrong-model routing must NOT raise."""
    out = AiPerplexityPlugin().ai_complete(
        messages=[{"role": "user", "content": "x"}],
        model=model,  # type: ignore[arg-type]
        api_key="k",
    )
    assert out is None


@pytest.mark.parametrize("model", ["sonar", "sonar-pro", "sonar-reasoning"])
def test_ai_complete_routes_sonar_models(model):
    with patch(
        "adaptive_learner_ai_perplexity.plugin._complete", return_value="ok"
    ) as complete_mock:
        out = AiPerplexityPlugin().ai_complete(
            messages=[{"role": "user", "content": "x"}],
            model=model,
            api_key="pplx-k",
        )
    assert out == "ok"
    complete_mock.assert_called_once()
    assert SONAR_MODEL_PREFIX == "sonar"


def test_ai_complete_forwards_max_tokens():
    with patch(
        "adaptive_learner_ai_perplexity.plugin._complete", return_value="ok"
    ) as complete_mock:
        AiPerplexityPlugin().ai_complete(
            messages=[{"role": "user", "content": "x"}],
            model="sonar-pro",
            api_key="pplx-k",
            max_tokens=256,
        )
    assert complete_mock.call_args.kwargs["max_tokens"] == 256


def test_ai_complete_stream_returns_none_for_non_sonar_models():
    out = AiPerplexityPlugin().ai_complete_stream(
        messages=[{"role": "user", "content": "x"}],
        model="gpt-4o",
        api_key="k",
    )
    assert out is None
