"""Tests for the multiple_choice quality checks in validate_lesson (#890)."""

from __future__ import annotations

from validate_content import validate_lesson


def _exercise(**overrides: object) -> dict:
    exercise: dict = {
        "id": "ex-mc",
        "type": "multiple_choice",
        "prompt": "What is the capital of France?",
        "options": ["Berlin", "Paris", "Madrid"],
        "correct_options": [1],
        "distractors": [],
    }
    exercise.update(overrides)
    return exercise


def _lesson(exercise: dict) -> dict:
    return {
        "cards": [],
        "steps": [
            {"id": "intro", "type": "theory", "body": "# Theory"},
            {"id": exercise["id"], "type": "exercise", "exercise": exercise},
        ],
    }


def _exercise_errors(exercise: dict) -> list[str]:
    """Only the per-exercise errors (ignore the lesson-count minimums,
    which are irrelevant to the per-type rule under test)."""
    errors: list[str] = []
    validate_lesson(_lesson(exercise), "de", "set/01.json", errors)
    return [e for e in errors if "multiple_choice" in e]


def test_valid_single_correct_passes() -> None:
    assert _exercise_errors(_exercise()) == []


def test_valid_multi_correct_passes() -> None:
    assert (
        _exercise_errors(
            _exercise(options=["2", "4", "5", "9"], correct_options=[0, 2])
        )
        == []
    )


def test_too_few_options_flagged() -> None:
    errors = _exercise_errors(_exercise(options=["Paris"], correct_options=[0]))
    assert any("needs >= 2 options" in e for e in errors)


def test_missing_correct_option_flagged() -> None:
    errors = _exercise_errors(_exercise(correct_options=[]))
    assert any("needs >= 1 correct option" in e for e in errors)


def test_out_of_range_correct_option_flagged() -> None:
    errors = _exercise_errors(_exercise(correct_options=[5]))
    assert any("out-of-range" in e for e in errors)


def test_duplicate_correct_options_flagged() -> None:
    errors = _exercise_errors(
        _exercise(options=["a", "b", "c"], correct_options=[1, 1])
    )
    assert any("duplicate" in e for e in errors)
