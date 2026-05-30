"""ElementError service unit tests (Phase 46B / C5 / P-129).

Pins the upsert transition matrix from
``app.services.element_errors``:

  no-row + correct   → create row, error_count=0, streak=1
  no-row + wrong     → create row, error_count=1, streak=0,
                       last_error_at set
  wrong → wrong      → error_count++, streak stays 0
  wrong → correct    → streak goes 0→1
  correct → correct  → streak grows
  streak reaches MASTERY_THRESHOLD-1 + correct
                     → mastered flips True, mastered_at set
  mastered → wrong   → demoted: mastered=False, mastered_at=None,
                       streak=0, error_count++, last_error_at set
  any → correct      → user_answer / correct_answer updated to
                       latest attempt
  empty bulk         → returns [] without DB write

Uses ``TestClient`` to fire the lifespan (init_db + migration
head) then talks to the service via ``SessionLocal`` directly
— the tests don't go through HTTP.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Literal

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import ElementError
from app.schemas import ElementAttemptIn
from app.services.element_errors import (
    MASTERY_THRESHOLD,
    list_for_user,
    record_attempt,
    record_attempts,
)


@pytest.fixture()
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def user_id(client: TestClient) -> str:
    """Create a user via the API so we have a valid FK target."""
    r = client.post(
        "/api/users",
        json={"name": "Element-Test", "language": "en"},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _attempt(
    *,
    set_id: str = "language-fr-a1",
    lesson_id: str = "01-greetings.json",
    exercise_id: str = "ex-thanks",
    element_key: str = "merci",
    direction: Literal["source_to_target", "target_to_source"] = "target_to_source",
    element_type: str = "vocabulary",
    user_answer: str = "",
    correct_answer: str = "Merci",
    correct: bool,
) -> ElementAttemptIn:
    return ElementAttemptIn(
        set_id=set_id,
        lesson_id=lesson_id,
        exercise_id=exercise_id,
        element_key=element_key,
        direction=direction,
        element_type=element_type,
        user_answer=user_answer,
        correct_answer=correct_answer,
        correct=correct,
    )


# --- Threshold constant pin -------------------------------------------------


def test_mastery_threshold_is_3() -> None:
    """The Phase 46 D4 decision is encoded as the integer 3.
    If it changes, the user-facing celebration semantics + the
    service docstring + the test ladder below all need to move
    in lockstep."""
    assert MASTERY_THRESHOLD == 3


# --- no-row branches --------------------------------------------------------


def test_no_row_then_correct_creates_fresh_row_with_streak_1(
    user_id: str,
) -> None:
    db = SessionLocal()
    try:
        row = record_attempt(
            db,
            user_id,
            _attempt(correct=True, user_answer="merci"),
        )
        db.commit()
        assert row.error_count == 0
        assert row.correct_streak == 1
        assert row.mastered is False
        assert row.last_error_at is None
        assert row.user_answer == "merci"
        assert row.correct_answer == "Merci"
    finally:
        db.close()


def test_no_row_then_wrong_creates_fresh_row_with_error_1(
    user_id: str,
) -> None:
    db = SessionLocal()
    try:
        row = record_attempt(
            db,
            user_id,
            _attempt(correct=False, user_answer="bonjour"),
        )
        db.commit()
        assert row.error_count == 1
        assert row.correct_streak == 0
        assert row.mastered is False
        assert row.last_error_at is not None
        assert row.user_answer == "bonjour"
    finally:
        db.close()


# --- transition matrix on the same element ---------------------------------


def test_wrong_then_wrong_increments_error_count(user_id: str) -> None:
    db = SessionLocal()
    try:
        record_attempt(db, user_id, _attempt(correct=False))
        row = record_attempt(db, user_id, _attempt(correct=False))
        db.commit()
        assert row.error_count == 2
        assert row.correct_streak == 0
    finally:
        db.close()


def test_wrong_then_correct_starts_streak_at_1(user_id: str) -> None:
    db = SessionLocal()
    try:
        record_attempt(db, user_id, _attempt(correct=False))
        row = record_attempt(db, user_id, _attempt(correct=True))
        db.commit()
        # error_count NOT decremented (lifetime monotonic)
        assert row.error_count == 1
        assert row.correct_streak == 1
        assert row.mastered is False
    finally:
        db.close()


def test_correct_streak_grows(user_id: str) -> None:
    db = SessionLocal()
    try:
        for _ in range(MASTERY_THRESHOLD - 1):
            row = record_attempt(db, user_id, _attempt(correct=True))
        db.commit()
        assert row.correct_streak == MASTERY_THRESHOLD - 1
        assert row.mastered is False

    finally:
        db.close()


def test_mastered_flips_at_threshold(user_id: str) -> None:
    db = SessionLocal()
    try:
        # Three consecutive corrects flip mastered.
        for _ in range(MASTERY_THRESHOLD):
            row = record_attempt(db, user_id, _attempt(correct=True))
        db.commit()
        assert row.correct_streak == MASTERY_THRESHOLD
        assert row.mastered is True
        assert row.mastered_at is not None
    finally:
        db.close()


def test_mastered_stays_true_on_further_corrects(user_id: str) -> None:
    """Once flipped, mastered_at does NOT bounce on every
    subsequent correct. The transition is once-per-cycle."""
    db = SessionLocal()
    try:
        for _ in range(MASTERY_THRESHOLD):
            row = record_attempt(db, user_id, _attempt(correct=True))
        # SQLite strips tzinfo on roundtrip; compare naive values
        # so an attribute re-read after flush doesn't break the
        # equality test on otherwise-identical timestamps.
        first_mastered_at = row.mastered_at.replace(tzinfo=None)
        # Two more corrects.
        record_attempt(db, user_id, _attempt(correct=True))
        row = record_attempt(db, user_id, _attempt(correct=True))
        db.commit()
        assert row.mastered is True
        later = row.mastered_at.replace(tzinfo=None) if row.mastered_at else None
        assert later == first_mastered_at
        assert row.correct_streak == MASTERY_THRESHOLD + 2
    finally:
        db.close()


def test_mastered_demotes_on_wrong(user_id: str) -> None:
    """Pedagogical decision: a wrong answer on a mastered
    element flips it back so SRS schedules another review."""
    db = SessionLocal()
    try:
        for _ in range(MASTERY_THRESHOLD):
            record_attempt(db, user_id, _attempt(correct=True))
        # Now wrong.
        row = record_attempt(db, user_id, _attempt(correct=False))
        db.commit()
        assert row.mastered is False
        assert row.mastered_at is None
        assert row.correct_streak == 0
        assert row.error_count == 1
        assert row.last_error_at is not None
    finally:
        db.close()


def test_user_answer_and_correct_answer_track_latest_attempt(
    user_id: str,
) -> None:
    """On every attempt, user_answer + correct_answer overwrite
    so the review screen can surface the most recent context."""
    db = SessionLocal()
    try:
        record_attempt(
            db,
            user_id,
            _attempt(correct=False, user_answer="bonjour"),
        )
        row = record_attempt(
            db,
            user_id,
            _attempt(correct=False, user_answer="salut"),
        )
        db.commit()
        assert row.user_answer == "salut"
        assert row.correct_answer == "Merci"
    finally:
        db.close()


# --- composite-key isolation -----------------------------------------------


def test_different_element_keys_get_separate_rows(user_id: str) -> None:
    db = SessionLocal()
    try:
        record_attempt(db, user_id, _attempt(element_key="merci", correct=False))
        record_attempt(
            db,
            user_id,
            _attempt(element_key="bonjour", correct=False),
        )
        db.commit()
        all_rows = list_for_user(db, user_id)
        keys = {r.element_key for r in all_rows}
        assert keys == {"merci", "bonjour"}
    finally:
        db.close()


def test_same_element_different_lesson_gets_separate_rows(
    user_id: str,
) -> None:
    """D2 lesson-scoped element keys: same word in two
    different lessons = two rows."""
    db = SessionLocal()
    try:
        record_attempt(
            db,
            user_id,
            _attempt(lesson_id="01-greetings.json", correct=False),
        )
        record_attempt(
            db,
            user_id,
            _attempt(lesson_id="02-numbers.json", correct=False),
        )
        db.commit()
        rows = list_for_user(db, user_id)
        lesson_ids = {r.lesson_id for r in rows}
        assert lesson_ids == {"01-greetings.json", "02-numbers.json"}
        # Both rows count as 1 error each — they're separate
        # elements per the lesson-scoping rule.
        assert all(r.error_count == 1 for r in rows)
    finally:
        db.close()


def test_different_users_isolated(user_id: str, client: TestClient) -> None:
    other = client.post(
        "/api/users",
        json={"name": "Other", "language": "en"},
    )
    assert other.status_code in (200, 201)
    other_id = other.json()["id"]
    db = SessionLocal()
    try:
        record_attempt(db, user_id, _attempt(correct=False))
        # other user same composite key — should be a separate row.
        record_attempt(db, other_id, _attempt(correct=False))
        db.commit()
        assert len(list_for_user(db, user_id)) == 1
        assert len(list_for_user(db, other_id)) == 1
    finally:
        db.close()


# --- record_attempts bulk + edge cases --------------------------------------


def test_record_attempts_preserves_input_order(user_id: str) -> None:
    db = SessionLocal()
    try:
        attempts = [
            _attempt(element_key="merci", correct=False),
            _attempt(element_key="bonjour", correct=True),
            _attempt(element_key="au-revoir", correct=False),
        ]
        rows = record_attempts(db, user_id, attempts)
        db.commit()
        assert [r.element_key for r in rows] == [
            "merci",
            "bonjour",
            "au-revoir",
        ]
    finally:
        db.close()


def test_record_attempts_empty_input_returns_empty(user_id: str) -> None:
    db = SessionLocal()
    try:
        assert record_attempts(db, user_id, []) == []
        # No write either.
        assert db.query(ElementError).count() == 0
    finally:
        db.close()


def test_record_attempts_within_same_call_compounds_state(
    user_id: str,
) -> None:
    """A single bulk call that targets the same element three
    times in a row with correct=True should still flip
    mastered — proves the intra-call dispatcher updates the
    in-session row, not just three separate inserts."""
    db = SessionLocal()
    try:
        attempts = [_attempt(correct=True) for _ in range(MASTERY_THRESHOLD)]
        rows = record_attempts(db, user_id, attempts)
        db.commit()
        # All three returned references point at the same row.
        assert rows[0].id == rows[-1].id
        assert rows[-1].mastered is True
    finally:
        db.close()


# --- list_for_user filtering -----------------------------------------------


def test_list_for_user_filters_by_set_id(user_id: str) -> None:
    db = SessionLocal()
    try:
        record_attempt(db, user_id, _attempt(set_id="set-a", correct=False))
        record_attempt(db, user_id, _attempt(set_id="set-b", correct=False))
        db.commit()
        a_only = list_for_user(db, user_id, set_id="set-a")
        assert len(a_only) == 1
        assert a_only[0].set_id == "set-a"
    finally:
        db.close()


def test_list_for_user_can_exclude_mastered(user_id: str) -> None:
    db = SessionLocal()
    try:
        # Mastered element.
        for _ in range(MASTERY_THRESHOLD):
            record_attempt(db, user_id, _attempt(correct=True))
        # Unmastered element (different key).
        record_attempt(
            db,
            user_id,
            _attempt(element_key="bonjour", correct=False),
        )
        db.commit()
        all_rows = list_for_user(db, user_id, include_mastered=True)
        active_only = list_for_user(db, user_id, include_mastered=False)
        assert len(all_rows) == 2
        assert len(active_only) == 1
        assert active_only[0].element_key == "bonjour"
    finally:
        db.close()


# --- EXP-018 / Phase 62: direction-aware tracking --------------------------


def test_two_directions_are_independent_rows(user_id: str) -> None:
    """Same element_key, two directions → two distinct rows, each
    with its own error/streak state."""
    db = SessionLocal()
    try:
        receptive = record_attempt(
            db, user_id, _attempt(direction="target_to_source", correct=True)
        )
        productive = record_attempt(
            db, user_id, _attempt(direction="source_to_target", correct=False)
        )
        db.commit()
        assert receptive.id != productive.id
        assert receptive.direction == "target_to_source"
        assert productive.direction == "source_to_target"
        assert receptive.correct_streak == 1
        assert receptive.error_count == 0
        assert productive.correct_streak == 0
        assert productive.error_count == 1
        rows = list_for_user(db, user_id)
        assert len(rows) == 2
    finally:
        db.close()


def test_mastering_receptive_does_not_master_productive(user_id: str) -> None:
    """Three correct receptive attempts master the receptive row only;
    the productive row stays unmastered."""
    db = SessionLocal()
    try:
        for _ in range(MASTERY_THRESHOLD):
            record_attempt(db, user_id, _attempt(direction="target_to_source", correct=True))
        record_attempt(db, user_id, _attempt(direction="source_to_target", correct=True))
        db.commit()
        rows = {r.direction: r for r in list_for_user(db, user_id)}
        assert rows["target_to_source"].mastered is True
        assert rows["source_to_target"].mastered is False
    finally:
        db.close()


def test_is_fully_mastered_requires_both_directions(user_id: str) -> None:
    from app.services.element_errors import is_fully_mastered

    db = SessionLocal()
    try:
        # Master receptive only.
        for _ in range(MASTERY_THRESHOLD):
            record_attempt(db, user_id, _attempt(direction="target_to_source", correct=True))
        db.commit()
        rows = list_for_user(db, user_id)
        assert is_fully_mastered(rows) is False  # productive missing

        # Now master productive too.
        for _ in range(MASTERY_THRESHOLD):
            record_attempt(db, user_id, _attempt(direction="source_to_target", correct=True))
        db.commit()
        rows = list_for_user(db, user_id)
        assert is_fully_mastered(rows) is True
    finally:
        db.close()


def test_direction_defaults_to_receptive_when_omitted(user_id: str) -> None:
    """An attempt with no explicit direction records receptive."""
    db = SessionLocal()
    try:
        attempt = ElementAttemptIn(
            set_id="s",
            lesson_id="l",
            exercise_id="e",
            element_key="k",
            correct=True,
        )
        row = record_attempt(db, user_id, attempt)
        db.commit()
        assert row.direction == "target_to_source"
    finally:
        db.close()
