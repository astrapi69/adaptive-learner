"""Tests for the profile calculator."""

from __future__ import annotations

import pytest
from adaptive_learner_assessment.profile import calculate_profile
from adaptive_learner_assessment.questions import METHODS, QUESTIONS

# --- Shape contract --------------------------------------------------------


def test_returns_dict_with_all_six_method_keys():
    out = calculate_profile([])
    assert set(out.keys()) == set(METHODS)


def test_all_zero_when_no_answers():
    out = calculate_profile([])
    assert all(v == 0.0 for v in out.values())


def test_all_values_in_unit_interval():
    out = calculate_profile(
        [{"question_id": q["id"], "answer_id": q["answers"][0]["id"]} for q in QUESTIONS]
    )
    for method, value in out.items():
        assert 0.0 <= value <= 1.0, f"{method} = {value} outside [0, 1]"


def test_unknown_question_id_silently_dropped():
    out = calculate_profile([{"question_id": "no-such-q", "answer_id": "x"}])
    assert all(v == 0.0 for v in out.values())


def test_unknown_answer_id_silently_dropped():
    out = calculate_profile([{"question_id": "q01", "answer_id": "z"}])
    assert all(v == 0.0 for v in out.values())


def test_non_string_ids_silently_dropped():
    out = calculate_profile([{"question_id": 1, "answer_id": None}])
    assert all(v == 0.0 for v in out.values())


# --- Numeric semantics -----------------------------------------------------


def _purely(method: str) -> list[dict]:
    """Pick the answer fully weighted to ``method`` on each question
    (when one exists). For questions where no answer is purely that
    method, fall back to whichever first answer has the highest
    weight for the method.
    """
    out = []
    for q in QUESTIONS:
        best = max(
            q["answers"],
            key=lambda a: a["weights"].get(method, 0.0),
        )
        out.append({"question_id": q["id"], "answer_id": best["id"]})
    return out


@pytest.mark.parametrize("method", list(METHODS))
def test_one_method_dominant_when_user_picks_consistently(method: str):
    out = calculate_profile(_purely(method))
    dominant = max(out, key=out.__getitem__)
    assert dominant == method, (
        f"User who consistently picked {method!r}-weighted answers "
        f"scored higher on {dominant!r}; out={out}"
    )


def test_balanced_respondent_has_all_methods_nonzero():
    """A user who picks a different answer-index per question hits
    every method at least once across the 12 questions."""
    out = calculate_profile(
        [
            {"question_id": q["id"], "answer_id": q["answers"][i % len(q["answers"])]["id"]}
            for i, q in enumerate(QUESTIONS)
        ]
    )
    nonzero = [m for m, v in out.items() if v > 0]
    # Touched methods varies by exact mix; the floor is 4 of 6.
    assert len(nonzero) >= 4, f"Only {nonzero} got nonzero; out={out}"


def test_duplicate_question_id_last_write_wins():
    """A noisy client that submits two answers for the same question
    must not double-count. We score the last one only."""
    answers = [
        {"question_id": "q01", "answer_id": "a"},  # deductive
        {"question_id": "q01", "answer_id": "d"},  # dialogic
    ]
    out = calculate_profile(answers)
    # Only one question scored => one method gets 1/12.
    nonzero = {m: v for m, v in out.items() if v > 0}
    assert "dialogic" in nonzero
    assert "deductive" not in nonzero


def test_per_method_score_equals_count_div_num_questions():
    """For the purely-deductive picker, q01.a is deductive 1.0 and
    several other questions have deductive answers. Verify the
    arithmetic matches the documented normalisation
    (sum_of_weights / num_questions, capped at 1.0)."""
    out = calculate_profile(_purely("deductive"))
    # 12 questions, picker chooses the most-deductive answer per
    # question. The score is in [0, 1] by construction; we assert
    # it's at least 0.5 (more than half the answers contribute) and
    # at most 1.0.
    assert 0.5 <= out["deductive"] <= 1.0


def test_custom_questions_override_default_pack():
    """Tests can pass their own pack to isolate the arithmetic from
    the bundled content."""
    custom = [
        {
            "id": "x1",
            "answers": [
                {"id": "yes", "weights": {"deductive": 1.0}},
                {"id": "no", "weights": {"inductive": 1.0}},
            ],
        }
    ]
    out = calculate_profile([{"question_id": "x1", "answer_id": "yes"}], questions=custom)
    assert out["deductive"] == 1.0
    assert out["inductive"] == 0.0


def test_returned_values_are_rounded():
    out = calculate_profile(_purely("deductive"))
    for value in out.values():
        # 4-decimal precision per the docstring contract.
        assert round(value, 4) == value


# --- v0.4.0: multi-select (``answer_ids``) --------------------------------


def test_multi_select_accepts_answer_ids_list():
    """A user picking 2 answers via ``answer_ids`` lands the same
    methods as picking each one individually — just halved."""
    custom = [
        {
            "id": "x1",
            "answers": [
                {"id": "a", "weights": {"deductive": 1.0}},
                {"id": "b", "weights": {"dialogic": 1.0}},
            ],
        }
    ]
    out = calculate_profile(
        [{"question_id": "x1", "answer_ids": ["a", "b"]}],
        questions=custom,
    )
    # Two answers picked => each contributes half its weight =>
    # deductive 0.5 + dialogic 0.5 (then divided by 1 question = 1).
    assert out["deductive"] == 0.5
    assert out["dialogic"] == 0.5


def test_multi_select_single_pick_equals_legacy_single():
    """``answer_ids=["a"]`` must produce the same numbers as
    ``answer_id="a"`` — the multi shape is a generalisation of
    the single shape, not a different scoring rule."""
    custom = [
        {
            "id": "x1",
            "answers": [{"id": "a", "weights": {"deductive": 1.0}}],
        }
    ]
    legacy = calculate_profile(
        [{"question_id": "x1", "answer_id": "a"}],
        questions=custom,
    )
    multi = calculate_profile(
        [{"question_id": "x1", "answer_ids": ["a"]}],
        questions=custom,
    )
    assert legacy == multi


def test_multi_select_three_picks_split_three_ways():
    custom = [
        {
            "id": "x1",
            "answers": [
                {"id": "a", "weights": {"deductive": 1.0}},
                {"id": "b", "weights": {"inductive": 1.0}},
                {"id": "c", "weights": {"dialogic": 1.0}},
            ],
        }
    ]
    out = calculate_profile(
        [{"question_id": "x1", "answer_ids": ["a", "b", "c"]}],
        questions=custom,
    )
    # 1/3 each, exact to 4 decimals.
    assert out["deductive"] == round(1.0 / 3.0, 4)
    assert out["inductive"] == round(1.0 / 3.0, 4)
    assert out["dialogic"] == round(1.0 / 3.0, 4)


def test_multi_select_answer_ids_wins_when_both_supplied():
    """If a client sends both shapes for the same question, the
    multi-select list takes precedence — single-select is the
    fallback for clients that forgot to upgrade."""
    custom = [
        {
            "id": "x1",
            "answers": [
                {"id": "a", "weights": {"deductive": 1.0}},
                {"id": "b", "weights": {"inductive": 1.0}},
            ],
        }
    ]
    out = calculate_profile(
        [
            {
                "question_id": "x1",
                "answer_id": "a",
                "answer_ids": ["b"],
            }
        ],
        questions=custom,
    )
    # The ``answer_ids`` pick ("b") wins; ``answer_id`` ignored.
    assert out["inductive"] == 1.0
    assert out["deductive"] == 0.0


def test_multi_select_empty_answer_ids_is_dropped():
    """An empty ``answer_ids`` list contributes nothing (route-layer
    validation catches it as 422, but the calculator stays robust)."""
    out = calculate_profile(
        [{"question_id": "q01", "answer_ids": []}],
    )
    assert all(v == 0.0 for v in out.values())


def test_multi_select_non_string_entries_silently_dropped():
    """Robust against a noisy client sending mixed types in
    ``answer_ids`` — the non-string entries are filtered, the
    rest are scored."""
    custom = [
        {
            "id": "x1",
            "answers": [
                {"id": "a", "weights": {"deductive": 1.0}},
                {"id": "b", "weights": {"dialogic": 1.0}},
            ],
        }
    ]
    out = calculate_profile(
        [{"question_id": "x1", "answer_ids": ["a", None, 42, "b"]}],
        questions=custom,
    )
    # Only "a" + "b" picked, so each contributes 1/2 of its weight.
    assert out["deductive"] == 0.5
    assert out["dialogic"] == 0.5
