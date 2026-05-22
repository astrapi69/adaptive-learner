"""Pure-unit tests for the pronunciation prompts + parsers
(Phase 31C)."""

from __future__ import annotations

import json

from adaptive_learner_session.pronunciation import (
    JudgeVerdict,
    build_judge_prompt,
    build_phrase_prompt,
    parse_judge_response,
    parse_phrase_response,
)


# --- Phrase prompt builder ------------------------------------------------


def test_build_phrase_prompt_includes_language_level_focus() -> None:
    p = build_phrase_prompt(
        language="Spanish",
        level="intermediate",
        focus="rolled r sounds",
    )
    assert "Spanish" in p
    assert "Intermediate" in p
    assert "rolled r sounds" in p


def test_build_phrase_prompt_clips_previous_to_last_five() -> None:
    p = build_phrase_prompt(
        language="French",
        previous=[f"phrase {i}" for i in range(10)],
    )
    # Only the last 5 should appear.
    assert "phrase 9" in p
    assert "phrase 5" in p
    assert "phrase 4" not in p


def test_build_phrase_prompt_omits_previous_clause_when_empty() -> None:
    p = build_phrase_prompt(language="German")
    assert "Avoid these phrases" not in p


# --- Phrase parser --------------------------------------------------------


def test_parse_phrase_returns_string() -> None:
    raw = '{"phrase": "Hola mundo"}'
    assert parse_phrase_response(raw) == "Hola mundo"


def test_parse_phrase_strips_markdown_fence() -> None:
    raw = '```json\n{"phrase": "Bonjour le monde"}\n```'
    assert parse_phrase_response(raw) == "Bonjour le monde"


def test_parse_phrase_empty_string_returns_none() -> None:
    assert parse_phrase_response("") is None
    assert parse_phrase_response("not json") is None
    assert parse_phrase_response('{"phrase": "   "}') is None


def test_parse_phrase_non_object_returns_none() -> None:
    # The model accidentally returned an array — we treat as
    # parse failure, not a string.
    assert parse_phrase_response('["Bonjour"]') is None


# --- Judge prompt builder ------------------------------------------------


def test_build_judge_prompt_includes_target_actual_language() -> None:
    p = build_judge_prompt(
        target="Yo hablo español",
        actual="Yo ablo espanol",
        language="Spanish",
    )
    assert "Yo hablo español" in p
    assert "Yo ablo espanol" in p
    assert "Spanish" in p


# --- Judge parser --------------------------------------------------------


def test_parse_judge_returns_verdict_dataclass() -> None:
    raw = json.dumps(
        {
            "matches": True,
            "score": 0.85,
            "feedback": "Almost perfect — watch the 'h'.",
            "missed_sounds": ["h"],
        }
    )
    verdict = parse_judge_response(raw)
    assert verdict is not None
    assert isinstance(verdict, JudgeVerdict)
    assert verdict.matches is True
    assert verdict.score == 0.85
    assert verdict.feedback.startswith("Almost")
    assert verdict.missed_sounds == ["h"]


def test_parse_judge_clamps_score_to_unit_interval() -> None:
    raw = '{"matches": true, "score": 1.5, "feedback": "x"}'
    verdict = parse_judge_response(raw)
    assert verdict is not None
    assert verdict.score == 1.0
    # Negative score also clamps.
    raw = '{"matches": false, "score": -0.5, "feedback": "x"}'
    verdict = parse_judge_response(raw)
    assert verdict is not None
    assert verdict.score == 0.0


def test_parse_judge_string_matches_coerces() -> None:
    # Some models return "true"/"false" as strings.
    raw = '{"matches": "true", "score": 0.9, "feedback": "x"}'
    verdict = parse_judge_response(raw)
    assert verdict is not None
    assert verdict.matches is True
    raw = '{"matches": "no", "score": 0.9, "feedback": "x"}'
    verdict = parse_judge_response(raw)
    assert verdict is not None
    assert verdict.matches is False


def test_parse_judge_derives_matches_from_score_when_missing() -> None:
    # No ``matches`` field → derived from score ≥ 0.7.
    raw = '{"score": 0.8, "feedback": "x"}'
    verdict = parse_judge_response(raw)
    assert verdict is not None
    assert verdict.matches is True
    raw = '{"score": 0.5, "feedback": "x"}'
    verdict = parse_judge_response(raw)
    assert verdict is not None
    assert verdict.matches is False


def test_parse_judge_normalises_missed_sounds() -> None:
    raw = json.dumps(
        {
            "matches": True,
            "score": 0.7,
            "feedback": "x",
            "missed_sounds": ["h", "", None, "r"],
        }
    )
    verdict = parse_judge_response(raw)
    assert verdict is not None
    # "" and None dropped; order preserved.
    assert verdict.missed_sounds == ["h", "r"]


def test_parse_judge_non_json_returns_none() -> None:
    assert parse_judge_response("") is None
    assert parse_judge_response("not json") is None


def test_parse_judge_strips_markdown_fence() -> None:
    raw = '```json\n{"matches": true, "score": 1.0, "feedback": "ok"}\n```'
    verdict = parse_judge_response(raw)
    assert verdict is not None
    assert verdict.score == 1.0


def test_judge_verdict_to_dict() -> None:
    v = JudgeVerdict(
        matches=True, score=0.9, feedback="ok", missed_sounds=["x"]
    )
    d = v.to_dict()
    assert d["matches"] is True
    assert d["score"] == 0.9
    assert d["missed_sounds"] == ["x"]
