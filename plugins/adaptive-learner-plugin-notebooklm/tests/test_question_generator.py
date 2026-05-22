"""Pure-unit tests for the study-question parser (Phase 32B)."""

from __future__ import annotations

import json

from adaptive_learner_notebooklm.question_generator import (
    GeneratedQuestion,
    build_prompt,
    parse_response,
)


# --- Prompt builder ----------------------------------------------------

def test_build_prompt_includes_content_and_limit() -> None:
    p = build_prompt("USER: Hi\nASSISTANT: Hello", limit=5)
    assert "Hi" in p
    assert "5" in p


def test_build_prompt_clips_long_content() -> None:
    long = "x" * 12000
    p = build_prompt(long)
    # 8000-char cap.
    assert "x" * 8001 not in p


# --- parse_response ----------------------------------------------------

def test_parse_valid_array() -> None:
    raw = json.dumps(
        [
            {
                "question": "What is X?",
                "expected_answer": "X is foo.",
                "type": "open",
                "difficulty": "easy",
                "topic": "basics",
            },
            {
                "question": "The capital of Y is ___.",
                "expected_answer": "Z",
                "type": "fill_blank",
                "difficulty": "medium",
                "topic": "geography",
            },
        ]
    )
    out = parse_response(raw)
    assert len(out) == 2
    assert out[0].question == "What is X?"
    assert out[0].question_type == "open"
    assert out[0].difficulty == "easy"
    assert out[1].question_type == "fill_blank"


def test_parse_strips_markdown_fence() -> None:
    raw = '```json\n[{"question":"Q","expected_answer":"A","type":"open","difficulty":"medium","topic":"t"}]\n```'
    out = parse_response(raw)
    assert len(out) == 1
    assert out[0].question == "Q"


def test_parse_coerces_unknown_type_to_open() -> None:
    raw = json.dumps(
        [
            {
                "question": "Q",
                "expected_answer": "A",
                "type": "trivia",  # unknown
                "difficulty": "medium",
                "topic": "t",
            }
        ]
    )
    out = parse_response(raw)
    assert len(out) == 1
    assert out[0].question_type == "open"


def test_parse_coerces_unknown_difficulty_to_medium() -> None:
    raw = json.dumps(
        [
            {
                "question": "Q",
                "expected_answer": "A",
                "type": "open",
                "difficulty": "impossible",
                "topic": "t",
            }
        ]
    )
    out = parse_response(raw)
    assert out[0].difficulty == "medium"


def test_parse_lowercases_type_and_difficulty() -> None:
    raw = json.dumps(
        [
            {
                "question": "Q",
                "expected_answer": "A",
                "type": "OPEN",
                "difficulty": "EASY",
                "topic": "t",
            }
        ]
    )
    out = parse_response(raw)
    assert out[0].question_type == "open"
    assert out[0].difficulty == "easy"


def test_parse_skips_rows_with_empty_question() -> None:
    raw = json.dumps(
        [
            {"question": "", "expected_answer": "A"},
            {"question": "   ", "expected_answer": "A"},
            {"question": "real", "expected_answer": "A"},
        ]
    )
    out = parse_response(raw)
    assert len(out) == 1
    assert out[0].question == "real"


def test_parse_defaults_missing_expected_answer_to_empty() -> None:
    raw = json.dumps([{"question": "Q"}])
    out = parse_response(raw)
    assert out[0].expected_answer == ""


def test_parse_truncates_topic_to_200_chars() -> None:
    raw = json.dumps(
        [{"question": "Q", "topic": "x" * 500}]
    )
    out = parse_response(raw)
    assert len(out[0].topic) == 200


def test_parse_empty_string_returns_empty_list() -> None:
    assert parse_response("") == []


def test_parse_non_json_returns_empty_list() -> None:
    assert parse_response("not json") == []


def test_parse_non_array_returns_empty_list() -> None:
    # If the model returns a single object instead of an array.
    assert parse_response('{"question":"Q"}') == []


def test_generated_question_dataclass_roundtrip() -> None:
    q = GeneratedQuestion(
        question="Q",
        expected_answer="A",
        question_type="open",
        difficulty="medium",
        topic="t",
    )
    assert q.question == "Q"
    assert q.question_type == "open"
