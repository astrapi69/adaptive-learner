"""Unit tests for the v1.4.0 topic-transition module.

Same pattern as ``test_step_evaluator.py``: backend-free, AI calls
mocked through a fake pluggy-style PluginManager whose
``hook.ai_complete`` returns a canned string.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from adaptive_learner_session.topic_transition import (
    DIFFICULTY_VALUES,
    TRANSITION_DEFAULT_MAX_TOKENS,
    TRANSITION_SYSTEM_PROMPT,
    TopicTransition,
    build_transition_messages,
    evaluate_topic_transition,
    parse_transition_response,
)


def _ok_json(
    *,
    cycle_complete: bool = True,
    summary: str = "Learner integrated subjunctive triggers.",
    next_topic: str | None = "Subjunctive with emotion verbs",
    next_topic_rationale: str = "Natural progression",
    difficulty_adjustment: str = "same",
    continue_recommended: bool = True,
) -> str:
    return json.dumps(
        {
            "cycle_complete": cycle_complete,
            "summary": summary,
            "next_topic": next_topic,
            "next_topic_rationale": next_topic_rationale,
            "difficulty_adjustment": difficulty_adjustment,
            "continue_recommended": continue_recommended,
        }
    )


def _fake_pm(reply: str | None | type[BaseException]):
    def _ai_complete(messages, model, api_key, max_tokens=None):  # noqa: ARG001
        if isinstance(reply, type) and issubclass(reply, BaseException):
            raise reply("simulated provider failure")
        return reply

    return SimpleNamespace(hook=SimpleNamespace(ai_complete=_ai_complete))


# --- Constants -------------------------------------------------------------


def test_system_prompt_carries_full_schema():
    assert "JSON" in TRANSITION_SYSTEM_PROMPT
    assert '"cycle_complete"' in TRANSITION_SYSTEM_PROMPT
    assert '"summary"' in TRANSITION_SYSTEM_PROMPT
    assert '"next_topic"' in TRANSITION_SYSTEM_PROMPT
    assert '"difficulty_adjustment"' in TRANSITION_SYSTEM_PROMPT
    assert '"continue_recommended"' in TRANSITION_SYSTEM_PROMPT


def test_difficulty_values_are_three_strings():
    assert DIFFICULTY_VALUES == ("same", "easier", "harder")


# --- build_transition_messages --------------------------------------------


def test_messages_have_system_and_user_role():
    messages = build_transition_messages(
        goal="Master Spanish",
        topic="Subjunctive triggers",
        method="deductive",
        history=[
            {"role": "user", "content": "Why porque vs. para que?"},
            {"role": "assistant", "content": "Different triggers..."},
        ],
        output_language="de",
    )
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert "Subjunctive triggers" in messages[1]["content"]
    assert "deductive" in messages[1]["content"]
    assert "de" in messages[1]["content"]


def test_messages_truncate_long_history():
    history = [
        {"role": "user", "content": f"msg {i}"} for i in range(20)
    ]
    messages = build_transition_messages(
        goal="x",
        topic="y",
        method="deductive",
        history=history,
        output_language="en",
    )
    user_content = messages[1]["content"]
    assert "msg 19" in user_content
    # The first 12 messages should not be included (last 8 only)
    assert "msg 0" not in user_content


# --- parse_transition_response --------------------------------------------


def test_parses_well_formed_response():
    result = parse_transition_response(_ok_json())
    assert isinstance(result, TopicTransition)
    assert result.fallback_used is False
    assert result.cycle_complete is True
    assert result.continue_recommended is True
    assert result.next_topic == "Subjunctive with emotion verbs"
    assert result.difficulty_adjustment == "same"


def test_unwraps_markdown_code_fence():
    raw = "```json\n" + _ok_json() + "\n```"
    result = parse_transition_response(raw)
    assert result.fallback_used is False
    assert result.cycle_complete is True


def test_extracts_json_from_surrounding_prose():
    raw = "Sure, here you go:\n" + _ok_json() + "\nLet me know if you need more."
    result = parse_transition_response(raw)
    assert result.fallback_used is False


def test_falls_back_on_empty_response():
    result = parse_transition_response("")
    assert result.fallback_used is True
    assert result.cycle_complete is False
    assert result.continue_recommended is False
    assert result.next_topic is None


def test_falls_back_on_invalid_json():
    result = parse_transition_response("not valid json")
    assert result.fallback_used is True


def test_falls_back_when_required_field_missing():
    raw = json.dumps({"cycle_complete": True})  # missing continue_recommended
    result = parse_transition_response(raw)
    assert result.fallback_used is True


def test_clamps_invalid_difficulty_to_same():
    raw = _ok_json(difficulty_adjustment="impossible-value")
    result = parse_transition_response(raw)
    assert result.fallback_used is False
    assert result.difficulty_adjustment == "same"


def test_next_topic_null_is_preserved():
    raw = _ok_json(next_topic=None, continue_recommended=False)
    result = parse_transition_response(raw)
    assert result.fallback_used is False
    assert result.next_topic is None
    assert result.continue_recommended is False


def test_strips_excessive_whitespace_in_summary():
    raw = _ok_json(summary="   leading and trailing   ")
    result = parse_transition_response(raw)
    assert result.summary == "leading and trailing"


# --- evaluate_topic_transition --------------------------------------------


def test_evaluate_returns_topic_transition_dataclass():
    pm = _fake_pm(_ok_json())
    result = evaluate_topic_transition(
        pm=pm,
        goal="Master Spanish",
        topic="Subjunctive triggers",
        method="deductive",
        history=[],
        model="claude-sonnet-4-6",
        api_key="dummy-key",
    )
    assert isinstance(result, TopicTransition)
    assert result.cycle_complete is True
    assert result.continue_recommended is True


def test_evaluate_falls_back_on_provider_exception():
    pm = _fake_pm(RuntimeError)
    result = evaluate_topic_transition(
        pm=pm,
        goal="x",
        topic="y",
        method="deductive",
        history=[],
        model="m",
        api_key="k",
    )
    assert result.fallback_used is True
    assert result.cycle_complete is False
    assert result.continue_recommended is False


def test_evaluate_falls_back_on_unparseable_response():
    pm = _fake_pm("garbage response")
    result = evaluate_topic_transition(
        pm=pm,
        goal="x",
        topic="y",
        method="deductive",
        history=[],
        model="m",
        api_key="k",
    )
    assert result.fallback_used is True


def test_evaluate_default_max_tokens_is_256():
    """The default max_tokens cap matches the spec."""
    assert TRANSITION_DEFAULT_MAX_TOKENS == 256
