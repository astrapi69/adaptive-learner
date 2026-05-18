"""Unit tests for the session plugin's AI orchestration helpers.

These run from the standalone plugin test dir where ``app.*`` is
NOT on sys.path. The helpers under test are explicitly designed
to be importable without the backend (no top-level ``app.*``
imports), so the standalone suite catches regressions where
someone reaches into the backend at import time.
"""

from __future__ import annotations

from types import SimpleNamespace

from adaptive_learner_session import ai_orchestration


def test_default_models_covers_the_three_providers():
    assert "anthropic" in ai_orchestration.DEFAULT_MODELS
    assert "openai" in ai_orchestration.DEFAULT_MODELS
    assert "gemini" in ai_orchestration.DEFAULT_MODELS


def test_resolve_model_known_providers():
    assert ai_orchestration.resolve_model("anthropic").startswith("claude-")
    assert ai_orchestration.resolve_model("openai").startswith("gpt-")
    assert ai_orchestration.resolve_model("gemini").startswith("gemini-")


def test_resolve_model_unknown_provider_returns_none():
    assert ai_orchestration.resolve_model("nonsense") is None
    assert ai_orchestration.resolve_model("") is None


def test_build_messages_history_no_system_no_prior():
    """Single user message in, single user message out."""
    out = ai_orchestration.build_messages_history(
        system_prompt=None,
        prior_messages=[],
        new_user_content="Hello.",
    )
    assert out == [{"role": "user", "content": "Hello."}]


def test_build_messages_history_with_system_and_prior():
    """System prompt first, then prior chat in order, then the new turn."""
    out = ai_orchestration.build_messages_history(
        system_prompt="You are a coach.",
        prior_messages=[
            {"role": "user", "content": "What is X?"},
            {"role": "assistant", "content": "X is ..."},
        ],
        new_user_content="And what about Y?",
    )
    assert out == [
        {"role": "system", "content": "You are a coach."},
        {"role": "user", "content": "What is X?"},
        {"role": "assistant", "content": "X is ..."},
        {"role": "user", "content": "And what about Y?"},
    ]


def test_build_messages_history_filters_malformed_prior_rows():
    """Non-string role / content entries are skipped — defensive
    against a corrupted DB row reaching the AI provider."""
    out = ai_orchestration.build_messages_history(
        system_prompt=None,
        prior_messages=[
            {"role": "user", "content": "Good entry."},
            {"role": None, "content": "Bad role."},
            {"role": "assistant", "content": 12345},  # bad content type
            {"role": "user"},  # missing content
        ],
        new_user_content="x",
    )
    assert out == [
        {"role": "user", "content": "Good entry."},
        {"role": "user", "content": "x"},
    ]


def test_build_messages_history_empty_system_prompt_dropped():
    """Whitespace-only system prompt is treated as missing."""
    out = ai_orchestration.build_messages_history(
        system_prompt="   \n  ",
        prior_messages=[],
        new_user_content="ping",
    )
    assert out == [{"role": "user", "content": "ping"}]


def test_call_ai_complete_returns_string_from_hook():
    """The helper accepts the inner pluggy plugin manager (any
    object exposing ``.hook.ai_complete``) and forwards the call.
    """
    fake_pm = SimpleNamespace(
        hook=SimpleNamespace(ai_complete=lambda messages, model, api_key: "the reply")
    )
    out = ai_orchestration.call_ai_complete(
        pm=fake_pm,
        messages=[{"role": "user", "content": "x"}],
        model="claude-3-5-haiku-latest",
        api_key="sk-x",
    )
    assert out == "the reply"


def test_call_ai_complete_returns_none_when_no_provider_matches():
    """firstresult=True dispatch where every plugin returned None
    surfaces as None at the helper boundary too."""
    fake_pm = SimpleNamespace(
        hook=SimpleNamespace(ai_complete=lambda messages, model, api_key: None)
    )
    out = ai_orchestration.call_ai_complete(
        pm=fake_pm,
        messages=[{"role": "user", "content": "x"}],
        model="unknown-model",
        api_key="k",
    )
    assert out is None


def test_orchestration_result_dataclass():
    """The dataclass exists and accepts both fields."""
    r = ai_orchestration.AiOrchestrationResult(
        assistant_text="hi",
        ai_error=None,
    )
    assert r.assistant_text == "hi"
    assert r.ai_error is None
