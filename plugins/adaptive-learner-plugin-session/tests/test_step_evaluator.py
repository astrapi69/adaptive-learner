"""Unit tests for the v0.5.0 step-evaluator module.

The module is intentionally backend-free so this test file runs in
the standalone plugin test suite (no ``app.*`` on sys.path). All
AI calls are mocked via a fake plugin manager that returns canned
strings from ``ai_complete``.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from adaptive_learner_session.step_evaluator import (
    EVALUATION_SYSTEM_PROMPT,
    MAX_STEP,
    METHOD_EVAL_HINTS,
    MIN_STEP,
    STEP_DESCRIPTIONS,
    StepEvaluation,
    build_evaluation_messages,
    evaluate_step,
    parse_evaluation_response,
)


def _ok_json(
    advance: bool = True,
    confidence: float = 0.9,
    reason: str = "Looks ready.",
    suggested_step: int = 2,
) -> str:
    return json.dumps(
        {
            "advance": advance,
            "confidence": confidence,
            "reason": reason,
            "suggested_step": suggested_step,
        }
    )


def _fake_pm(reply: str | None | type[BaseException]):
    """Build a fake pluggy-style PluginManager whose ``hook.ai_complete``
    returns ``reply`` (or raises if ``reply`` is an exception class).
    """

    def _ai_complete(messages, model, api_key):  # noqa: ARG001
        if isinstance(reply, type) and issubclass(reply, BaseException):
            raise reply("simulated provider failure")
        return reply

    return SimpleNamespace(hook=SimpleNamespace(ai_complete=_ai_complete))


# --- Constants / schema ----------------------------------------------------


def test_step_range_constants_are_one_through_seven():
    assert MIN_STEP == 1
    assert MAX_STEP == 7


def test_step_descriptions_cover_every_step():
    assert set(STEP_DESCRIPTIONS.keys()) == set(range(1, 8))
    for desc in STEP_DESCRIPTIONS.values():
        assert isinstance(desc, str) and len(desc) > 0


def test_method_hints_cover_every_method():
    assert set(METHOD_EVAL_HINTS.keys()) == {
        "deductive",
        "inductive",
        "error_based",
        "dialogic",
        "contextual",
        "ai_adaptive",
    }


def test_system_prompt_is_english_and_mentions_schema():
    # Phase 8 Q3 settled on English prompt for cross-provider JSON
    # reliability; the schema MUST appear in the prompt verbatim so
    # the model has a structural target.
    assert "JSON" in EVALUATION_SYSTEM_PROMPT
    assert '"advance"' in EVALUATION_SYSTEM_PROMPT
    assert '"confidence"' in EVALUATION_SYSTEM_PROMPT
    assert '"reason"' in EVALUATION_SYSTEM_PROMPT
    assert '"suggested_step"' in EVALUATION_SYSTEM_PROMPT


# --- build_evaluation_messages --------------------------------------------


def test_build_messages_returns_system_plus_user():
    msgs = build_evaluation_messages(
        method="deductive",
        current_step=2,
        history=[{"role": "user", "content": "What is X?"}],
        output_language="en",
    )
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert msgs[0]["content"] == EVALUATION_SYSTEM_PROMPT
    assert msgs[1]["role"] == "user"


def test_build_messages_includes_method_step_lang_in_user_content():
    msgs = build_evaluation_messages(
        method="dialogic",
        current_step=4,
        history=[{"role": "user", "content": "let me try"}],
        output_language="de",
    )
    user = msgs[1]["content"]
    assert "method: dialogic" in user
    assert "current_step: 4" in user
    assert "output_language: de" in user
    # Step 4 description is "feedback — ..."; the descriptor must
    # be in the user content so the AI has the step's semantic.
    assert "feedback" in user
    # Method hint for dialogic should appear so the AI knows how
    # this method's readiness looks.
    assert METHOD_EVAL_HINTS["dialogic"].split()[0] in user


def test_build_messages_renders_recent_transcript():
    history = [
        {"role": "system", "content": "Welcome."},
        {"role": "user", "content": "first attempt"},
        {"role": "assistant", "content": "Try again."},
        {"role": "user", "content": "second attempt"},
    ]
    msgs = build_evaluation_messages(
        method="deductive", current_step=2, history=history, output_language="en"
    )
    user = msgs[1]["content"]
    assert "Learner: first attempt" in user
    assert "AI: Try again." in user
    assert "Learner: second attempt" in user


def test_build_messages_truncates_long_history_to_last_eight():
    history = [
        {"role": "user", "content": f"turn-{i}"} for i in range(20)
    ]
    msgs = build_evaluation_messages(
        method="deductive", current_step=2, history=history, output_language="en"
    )
    user = msgs[1]["content"]
    # The newest 8 turns must appear; the oldest 12 must not.
    assert "turn-19" in user
    assert "turn-12" in user
    assert "turn-11" not in user
    assert "turn-0" not in user


def test_build_messages_handles_empty_history_gracefully():
    msgs = build_evaluation_messages(
        method="deductive", current_step=1, history=[], output_language="en"
    )
    user = msgs[1]["content"]
    assert "(no exchanges yet)" in user


def test_build_messages_skips_malformed_history_rows():
    history = [
        {"role": "user", "content": "ok"},
        {"role": None, "content": "bad role"},
        {"role": "assistant", "content": 12345},  # non-string content
        {"role": "user"},  # missing content
    ]
    msgs = build_evaluation_messages(
        method="deductive", current_step=2, history=history, output_language="en"
    )
    user = msgs[1]["content"]
    assert "Learner: ok" in user
    assert "bad role" not in user
    assert "12345" not in user


# --- parse_evaluation_response --------------------------------------------


def test_parse_valid_json_returns_step_evaluation():
    out = parse_evaluation_response(_ok_json(), current_step=1)
    assert isinstance(out, StepEvaluation)
    assert out.advance is True
    assert out.confidence == 0.9
    assert out.reason == "Looks ready."
    assert out.suggested_step == 2
    assert out.fallback_used is False
    assert out.raw_response is not None


def test_parse_strips_markdown_json_fences():
    raw = "```json\n" + _ok_json() + "\n```"
    out = parse_evaluation_response(raw, current_step=1)
    assert out.fallback_used is False
    assert out.advance is True
    assert out.suggested_step == 2


def test_parse_strips_bare_markdown_fences():
    raw = "```\n" + _ok_json() + "\n```"
    out = parse_evaluation_response(raw, current_step=1)
    assert out.fallback_used is False
    assert out.advance is True


def test_parse_extracts_json_from_surrounding_prose():
    """Some models leak commentary before/after the JSON."""
    raw = "Sure! Here's my evaluation:\n" + _ok_json() + "\nLet me know."
    out = parse_evaluation_response(raw, current_step=1)
    assert out.fallback_used is False
    assert out.advance is True


def test_parse_clamps_out_of_range_step_to_max():
    raw = _ok_json(suggested_step=99)
    out = parse_evaluation_response(raw, current_step=3)
    assert out.suggested_step == MAX_STEP
    assert out.fallback_used is False


def test_parse_clamps_negative_step_to_min():
    raw = _ok_json(suggested_step=-3)
    out = parse_evaluation_response(raw, current_step=3)
    assert out.suggested_step == MIN_STEP


def test_parse_allows_backward_transition():
    """Phase 8 Q4 — the cycle is not a conveyor belt. The evaluator
    can recommend going backward (e.g. step 4 -> step 2) when the
    learner's last turn shows they need to re-attempt."""
    raw = _ok_json(advance=True, suggested_step=2)
    out = parse_evaluation_response(raw, current_step=4)
    assert out.advance is True
    assert out.suggested_step == 2


def test_parse_allows_repeat_via_same_step():
    raw = _ok_json(advance=False, suggested_step=3)
    out = parse_evaluation_response(raw, current_step=3)
    assert out.advance is False
    assert out.suggested_step == 3


def test_parse_clamps_confidence_above_one():
    raw = _ok_json(confidence=2.0)
    out = parse_evaluation_response(raw, current_step=1)
    assert out.confidence == 1.0


def test_parse_clamps_negative_confidence_to_zero():
    raw = _ok_json(confidence=-0.5)
    out = parse_evaluation_response(raw, current_step=1)
    assert out.confidence == 0.0


def test_parse_non_numeric_confidence_defaults_to_half():
    raw = json.dumps(
        {
            "advance": True,
            "confidence": "high",
            "reason": "ok",
            "suggested_step": 2,
        }
    )
    out = parse_evaluation_response(raw, current_step=1)
    assert out.confidence == 0.5


def test_parse_truncates_long_reason():
    long_reason = "a" * 1000
    raw = _ok_json(reason=long_reason)
    out = parse_evaluation_response(raw, current_step=1)
    assert len(out.reason) <= 240


def test_parse_empty_reason_falls_back_to_placeholder():
    raw = _ok_json(reason="")
    out = parse_evaluation_response(raw, current_step=1)
    assert out.reason == "(no reason provided)"


def test_parse_invalid_json_returns_deterministic_fallback():
    raw = "this is not JSON at all"
    out = parse_evaluation_response(raw, current_step=3)
    assert out.fallback_used is True
    assert out.advance is True
    assert out.suggested_step == 4  # current + 1


def test_parse_missing_advance_field_falls_back():
    raw = json.dumps(
        {"confidence": 0.8, "reason": "ok"}
    )  # no advance, no suggested_step
    out = parse_evaluation_response(raw, current_step=2)
    assert out.fallback_used is True
    assert out.suggested_step == 3  # current + 1


def test_parse_missing_suggested_step_falls_back():
    raw = json.dumps(
        {"advance": True, "confidence": 0.8, "reason": "ok"}
    )
    out = parse_evaluation_response(raw, current_step=2)
    assert out.fallback_used is True
    assert out.suggested_step == 3


def test_parse_at_step_seven_fallback_stays_at_seven():
    """At the integration step, the deterministic fallback must NOT
    push the learner past 7. The cycle ends at 7 in v0.5.0; auto-loop
    is deferred to v0.6.x (Phase 8 Q2)."""
    raw = "garbage"
    out = parse_evaluation_response(raw, current_step=7)
    assert out.fallback_used is True
    assert out.advance is False
    assert out.suggested_step == MAX_STEP


def test_parse_none_input_returns_fallback():
    out = parse_evaluation_response(None, current_step=2)
    assert out.fallback_used is True
    assert out.suggested_step == 3


def test_parse_empty_string_returns_fallback():
    out = parse_evaluation_response("   ", current_step=2)
    assert out.fallback_used is True


def test_parse_non_dict_json_returns_fallback():
    """The model returned valid JSON but it's a list, not an object."""
    out = parse_evaluation_response("[1, 2, 3]", current_step=2)
    assert out.fallback_used is True


def test_parse_records_raw_response_even_on_fallback():
    """For audit/debug: the raw model output is preserved on the
    StepEvaluation even when we couldn't parse it."""
    raw = "wat"
    out = parse_evaluation_response(raw, current_step=2)
    assert out.raw_response == raw


# --- All seven step transitions on valid JSON -----------------------------


@pytest.mark.parametrize(
    "current,suggested",
    [(1, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 7)],
)
def test_each_step_transition_with_valid_json(current: int, suggested: int):
    """Walks the canonical 1→2→3→4→5→6→7→7 path with valid JSON
    responses for each step. step 7 stays at 7 (advance=false,
    cycle ends at 7 per Phase 8 Q2)."""
    advance = current < MAX_STEP
    raw = _ok_json(
        advance=advance,
        confidence=0.9,
        reason=f"Ready to move from {current} to {suggested}.",
        suggested_step=suggested,
    )
    out = parse_evaluation_response(raw, current_step=current)
    assert out.fallback_used is False
    assert out.advance is advance
    assert out.suggested_step == suggested


# --- evaluate_step (end-to-end with mocked hook) --------------------------


def test_evaluate_step_round_trip_with_mocked_hook():
    pm = _fake_pm(_ok_json(advance=True, suggested_step=3, confidence=0.85))
    out = evaluate_step(
        pm=pm,
        method="deductive",
        current_step=2,
        history=[{"role": "user", "content": "I think the rule is X."}],
        model="claude-3-5-haiku-latest",
        api_key="sk-test",
        output_language="en",
    )
    assert isinstance(out, StepEvaluation)
    assert out.advance is True
    assert out.suggested_step == 3
    assert out.confidence == 0.85
    assert out.fallback_used is False


def test_evaluate_step_returns_fallback_when_hook_returns_none():
    pm = _fake_pm(None)
    out = evaluate_step(
        pm=pm,
        method="dialogic",
        current_step=3,
        history=[],
        model="x",
        api_key="x",
        output_language="en",
    )
    assert out.fallback_used is True
    assert out.suggested_step == 4


def test_evaluate_step_returns_fallback_when_hook_returns_garbage():
    pm = _fake_pm("not json at all")
    out = evaluate_step(
        pm=pm,
        method="contextual",
        current_step=5,
        history=[],
        model="x",
        api_key="x",
        output_language="de",
    )
    assert out.fallback_used is True
    assert out.suggested_step == 6


def test_evaluate_step_returns_fallback_when_hook_raises():
    """Provider exception must NEVER bubble up to the route layer."""
    pm = _fake_pm(RuntimeError)
    out = evaluate_step(
        pm=pm,
        method="error_based",
        current_step=2,
        history=[],
        model="x",
        api_key="x",
        output_language="en",
    )
    assert out.fallback_used is True
    assert out.suggested_step == 3


def test_evaluate_step_passes_recent_history_to_the_hook():
    """The transcript section of the user message must include the
    last user/assistant exchanges so the AI judges THIS conversation,
    not a generic case."""
    captured: dict[str, object] = {}

    def _capture(messages, model, api_key):  # noqa: ARG001
        captured["messages"] = messages
        return _ok_json()

    pm = SimpleNamespace(hook=SimpleNamespace(ai_complete=_capture))
    evaluate_step(
        pm=pm,
        method="inductive",
        current_step=2,
        history=[
            {"role": "user", "content": "My guess at the pattern is..."},
            {"role": "assistant", "content": "Close — try again."},
        ],
        model="x",
        api_key="x",
        output_language="en",
    )
    assert "messages" in captured
    msgs = captured["messages"]
    assert isinstance(msgs, list) and len(msgs) == 2
    user = msgs[1]["content"]
    assert "My guess at the pattern is..." in user
    assert "Close — try again." in user


# --- Confidence-threshold spec scenarios ---------------------------------
#
# The route layer (8B) will apply the threshold; the evaluator only
# REPORTS confidence. These tests pin the contract the route relies on:
# the confidence value in the parsed result equals what the AI said.


def test_high_confidence_advance_is_preserved_intact():
    raw = _ok_json(advance=True, confidence=0.95, suggested_step=4)
    out = parse_evaluation_response(raw, current_step=3)
    assert out.advance is True
    assert out.confidence == 0.95
    # Route layer threshold check (default 0.7) would PASS.
    assert out.confidence >= 0.7


def test_low_confidence_advance_is_preserved_intact():
    raw = _ok_json(advance=True, confidence=0.3, suggested_step=4)
    out = parse_evaluation_response(raw, current_step=3)
    assert out.advance is True
    assert out.confidence == 0.3
    # Route layer threshold check (default 0.7) would FAIL the
    # advance even though the AI suggested it — staying is safer.
    assert out.confidence < 0.7


def test_explicit_no_advance_keeps_advance_false():
    raw = _ok_json(advance=False, confidence=0.8, suggested_step=2)
    out = parse_evaluation_response(raw, current_step=2)
    assert out.advance is False
    # Route layer must respect explicit false regardless of threshold.
