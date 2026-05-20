"""Unit tests for the server-side conversation-analysis engine.

Mirrors the frontend ``analysis.test.ts`` coverage so that the
two engines stay in lockstep. The route-level integration test
that drives the full HTTP path lives in
``test_imports_router.py::test_analyze_*``.
"""

from __future__ import annotations

import json

from app.services.conversation_analysis import (
    Message,
    analyze_conversation_with_ai,
    build_analysis_user_content,
    chunk_messages,
    deterministic_fallback,
    merge_analyses,
    parse_analysis_response,
)


def test_build_user_content_labels_roles_and_includes_title():
    body = build_analysis_user_content(
        [Message("user", "what is induction?"), Message("assistant", "examples to rule.")],
        title="Bayes basics",
    )
    assert "Title: Bayes basics" in body
    assert "Learner: what is induction?" in body
    assert "AI: examples to rule." in body
    assert "Return only the JSON analysis" in body


def test_chunk_messages_single_chunk_when_under_threshold():
    msgs = [Message("user", "a" * 100), Message("assistant", "b" * 100)]
    assert chunk_messages(msgs, max_chars=10_000) == [msgs]


def test_chunk_messages_splits_with_two_message_overlap():
    msgs = [
        Message("user", "a" * 4000),
        Message("assistant", "b" * 4000),
        Message("user", "c" * 4000),
        Message("assistant", "d" * 4000),
        Message("user", "e" * 4000),
    ]
    chunks = chunk_messages(msgs, max_chars=10_000)
    assert len(chunks) >= 2
    # Overlap: the last 2 messages of chunk N appear as the first
    # 2 messages of chunk N+1.
    for i in range(len(chunks) - 1):
        assert chunks[i][-2:] == chunks[i + 1][:2]


def test_chunk_messages_empty():
    assert chunk_messages([]) == []


def test_parse_analysis_clamps_method_and_level():
    raw = json.dumps(
        {
            "topic": "Induction",
            "user_level": "INTERMEDIATE",  # case
            "recommended_method": "Error-Based",  # hyphen
            "summary": "ok",
        }
    )
    parsed = parse_analysis_response(raw)
    assert parsed == {
        "topic": "Induction",
        "user_level": "intermediate",
        "recommended_method": "error_based",
        "summary": "ok",
    }


def test_parse_analysis_drops_unknown_method_and_level():
    raw = json.dumps({"topic": "x", "user_level": "expert", "recommended_method": "telepathy"})
    parsed = parse_analysis_response(raw)
    assert parsed == {"topic": "x"}


def test_parse_analysis_strips_empty_array_items_and_returns_none_when_all_empty():
    raw = json.dumps(
        {
            "topic": "x",
            "strengths": ["  ", ""],
            "weaknesses": ["  real weakness  ", ""],
        }
    )
    parsed = parse_analysis_response(raw)
    assert parsed == {"topic": "x", "weaknesses": ["real weakness"]}


def test_parse_analysis_clamps_priority_to_one_through_five():
    raw = json.dumps(
        {
            "topic": "x",
            "suggested_curriculum": [
                {"title": "Lesson A", "description": "...", "priority": 99},
                {"title": "Lesson B", "description": "...", "priority": -3},
                {"title": "  ", "description": "Empty title dropped"},
            ],
        }
    )
    parsed = parse_analysis_response(raw)
    assert parsed is not None
    curriculum = parsed["suggested_curriculum"]
    assert len(curriculum) == 2
    assert curriculum[0]["priority"] == 5
    assert curriculum[1]["priority"] == 1


def test_parse_analysis_returns_none_on_garbage():
    assert parse_analysis_response("not json at all") is None


def test_parse_analysis_handles_prose_wrapped_json():
    raw = (
        "Here is the analysis you requested:\n"
        '{"topic": "Bayes", "user_level": "beginner"}\n'
        "Let me know if you need anything else."
    )
    parsed = parse_analysis_response(raw)
    assert parsed == {"topic": "Bayes", "user_level": "beginner"}


def test_merge_analyses_keeps_first_string_and_highest_level():
    a = {"topic": "Bayes", "user_level": "beginner", "summary": "first"}
    b = {"topic": "Stats", "user_level": "advanced", "summary": "second"}
    merged = merge_analyses(a, b)
    assert merged["topic"] == "Bayes"  # first non-empty wins
    assert merged["summary"] == "first"
    assert merged["user_level"] == "advanced"  # highest wins


def test_merge_analyses_concatenates_and_dedupes_string_arrays():
    a = {"strengths": ["Pattern recognition", "Curiosity"]}
    b = {"strengths": ["pattern recognition", "Asking why"]}
    merged = merge_analyses(a, b)
    # Case-insensitive dedupe, original casing preserved.
    assert merged["strengths"] == ["Pattern recognition", "Curiosity", "Asking why"]


def test_deterministic_fallback_carries_title():
    fb = deterministic_fallback("Calculus refresher")
    assert fb["topic"] == "Calculus refresher"
    assert fb["fallback_used"] is True


def test_analyze_conversation_returns_fallback_when_chunks_empty():
    result = analyze_conversation_with_ai(
        [],
        ai_complete_call=lambda messages: None,
        title="Empty",
    )
    assert result["fallback_used"] is True


def test_analyze_conversation_happy_path_with_fake_ai():
    """End-to-end inside the engine: the fake provider returns
    valid JSON, the engine parses + projects it, no fallback
    fires."""
    fake_response = json.dumps(
        {
            "topic": "Induction",
            "user_level": "beginner",
            "strengths": ["Asking concrete examples"],
            "weaknesses": ["Confuses inductive with abductive"],
            "recommended_method": "inductive",
            "summary": "Beginner asking sharp questions about induction.",
        }
    )

    def fake_ai_complete(messages: list[dict]) -> str:
        # Sanity: the system prompt + user content reach the provider.
        assert any(m["role"] == "system" for m in messages)
        assert any("Learner:" in m["content"] for m in messages if m["role"] == "user")
        return fake_response

    result = analyze_conversation_with_ai(
        [Message("user", "explain induction"), Message("assistant", "consider examples...")],
        ai_complete_call=fake_ai_complete,
        title="Induction primer",
    )
    assert result["topic"] == "Induction"
    assert result["recommended_method"] == "inductive"
    assert result.get("fallback_used") is None


def test_analyze_conversation_falls_back_on_provider_exception():
    def angry_provider(messages):
        raise RuntimeError("provider went away")

    result = analyze_conversation_with_ai(
        [Message("user", "x"), Message("assistant", "y")],
        ai_complete_call=angry_provider,
        title="Boom",
    )
    assert result["fallback_used"] is True
    assert "provider went away" in result["summary"]


def test_analyze_conversation_falls_back_on_unparseable_response():
    result = analyze_conversation_with_ai(
        [Message("user", "x"), Message("assistant", "y")],
        ai_complete_call=lambda messages: "not json at all, sorry",
        title="Junk",
    )
    assert result["fallback_used"] is True


def test_analyze_conversation_records_chunk_summaries_for_multi_chunk_runs():
    """When chunking fires, the engine records per-chunk summaries
    so the UI can render the per-segment breakdown."""
    msgs = [
        Message("user", "a" * 8000),
        Message("assistant", "b" * 8000),
        Message("user", "c" * 8000),
    ]
    call_count = {"n": 0}

    def fake(messages):
        call_count["n"] += 1
        return json.dumps(
            {"topic": f"chunk-{call_count['n']}", "summary": f"sum {call_count['n']}"}
        )

    result = analyze_conversation_with_ai(
        msgs,
        ai_complete_call=fake,
        title="Multi",
        max_chunk_chars=10_000,
    )
    assert call_count["n"] >= 2
    assert "chunk_summaries" in result
    assert len(result["chunk_summaries"]) == call_count["n"]
