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


def test_resolve_model_override_wins_over_default():
    """v0.4.0: a non-empty override replaces the default for that
    provider; the default is NOT consulted at all."""
    assert (
        ai_orchestration.resolve_model("anthropic", override="claude-sonnet-4-20250514")
        == "claude-sonnet-4-20250514"
    )
    assert (
        ai_orchestration.resolve_model("openai", override="gpt-4o")
        == "gpt-4o"
    )


def test_resolve_model_blank_override_falls_back_to_default():
    """``None``, ``""`` and whitespace-only overrides all behave
    the same as "no override"."""
    assert ai_orchestration.resolve_model("anthropic", override=None) == (
        ai_orchestration.DEFAULT_MODELS["anthropic"]
    )
    assert ai_orchestration.resolve_model("anthropic", override="") == (
        ai_orchestration.DEFAULT_MODELS["anthropic"]
    )
    assert ai_orchestration.resolve_model("anthropic", override="   ") == (
        ai_orchestration.DEFAULT_MODELS["anthropic"]
    )


def test_resolve_model_override_strips_whitespace():
    """A leading/trailing-space override is stripped before use —
    a copy-paste accident shouldn't produce an invalid model name."""
    assert (
        ai_orchestration.resolve_model("anthropic", override="  claude-sonnet-4-20250514\n")
        == "claude-sonnet-4-20250514"
    )


def test_resolve_model_override_works_for_unknown_provider():
    """An override lets a not-yet-shipped provider resolve to a
    model even though DEFAULT_MODELS doesn't know it — useful
    for users opting into a new provider before AdaptiveLearner ships
    its DEFAULT_MODELS row."""
    assert (
        ai_orchestration.resolve_model("future-provider", override="future-model-v1")
        == "future-model-v1"
    )


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
        hook=SimpleNamespace(ai_complete=lambda messages, model, api_key, max_tokens=None: "the reply")
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
        hook=SimpleNamespace(ai_complete=lambda messages, model, api_key, max_tokens=None: None)
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
