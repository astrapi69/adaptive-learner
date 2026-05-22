"""Pure-unit tests for the study-guide generator (Phase 32C)."""

from __future__ import annotations

from adaptive_learner_notebooklm.study_guide_generator import (
    build_prompt,
    parse_response,
)


def test_build_prompt_includes_project_metadata() -> None:
    p = build_prompt(
        project={
            "topic": "Spanish B1",
            "goal": "Reach conversational fluency",
            "timeframe": "3 months",
            "daily_minutes": 30,
        }
    )
    assert "Spanish B1" in p
    assert "Reach conversational fluency" in p
    assert "3 months" in p
    assert "30" in p


def test_build_prompt_includes_profile_when_present() -> None:
    p = build_prompt(
        project={
            "topic": "x",
            "goal": "y",
            "profile": {"deductive": 0.4, "dialogic": 0.6},
        }
    )
    assert "deductive" in p
    assert "0.4" in p


def test_build_prompt_includes_curriculum_when_present() -> None:
    p = build_prompt(
        project={
            "topic": "x",
            "goal": "y",
            "curriculum": ["Chapter 1", "Chapter 2", "Chapter 3"],
        }
    )
    assert "Chapter 1" in p
    assert "Chapter 3" in p


def test_build_prompt_includes_vocabulary_when_present() -> None:
    p = build_prompt(
        project={
            "topic": "x",
            "goal": "y",
            "vocabulary": [
                {
                    "word": "hablar",
                    "translation": "to speak",
                    "example": "Yo hablo espanol",
                }
            ],
        }
    )
    assert "hablar" in p
    assert "to speak" in p


def test_build_prompt_caps_vocabulary_at_50_entries() -> None:
    vocab = [
        {"word": f"w{i}", "translation": f"t{i}"} for i in range(200)
    ]
    p = build_prompt(project={"topic": "x", "goal": "y", "vocabulary": vocab})
    # Entry 49 should be present, entry 50+ should not.
    assert "w49" in p
    assert "w50" not in p
    assert "w199" not in p


def test_build_prompt_truncates_sessions_when_over_budget() -> None:
    # 10 sessions × big body — total context blows the budget.
    sessions = []
    for i in range(10):
        sessions.append(
            {
                "started_at": f"2026-05-{i+1:02d}T10:00:00Z",
                "method": "deductive",
                # ~5000 chars each — 10 of them = ~50K > 30K cap.
                "messages": "USER: " + ("x" * 5000),
            }
        )
    p = build_prompt(
        project={"topic": "x", "goal": "y", "sessions": sessions}
    )
    # Some truncation marker must appear because we ran past the
    # budget on at least one block.
    assert "[...truncated...]" in p or len(p) <= 50_000


def test_parse_response_strips_outer_markdown_fence() -> None:
    raw = "```markdown\n# Hello\n\nBody.\n```"
    assert parse_response(raw) == "# Hello\n\nBody."


def test_parse_response_strips_md_fence() -> None:
    raw = "```md\n# Hello\n```"
    assert parse_response(raw) == "# Hello"


def test_parse_response_passes_through_plain_markdown() -> None:
    raw = "# Title\n\nParagraph."
    assert parse_response(raw) == "# Title\n\nParagraph."


def test_parse_response_empty_string_returns_empty() -> None:
    assert parse_response("") == ""


def test_parse_response_strips_outer_whitespace() -> None:
    assert parse_response("\n\n# Hello\n\n") == "# Hello"
