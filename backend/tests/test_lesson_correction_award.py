"""Correction-adjusted lesson XP award (#2479).

The main lesson run freezes ``LessonProgress.score_correct/score_total``; the
correction round advances SRS ``ElementError`` rows without lifting it. The
award used to score on the frozen first pass, so a learner who fixed every
mistake was credited first-pass XP under a summary showing final-state stars.

These pin the backend (API-mode) half of the fix: ``award_xp_for_lesson_session``
folds the corrected elements into the star count for non-exam modes (the
Dexie half is pinned in ``lesson-xp-dexie.test.ts``), and exam mode stays on
the first pass.
"""

from __future__ import annotations

from datetime import UTC, datetime

from adaptive_learner_gamification.xp_service import award_xp_for_lesson_session

from app.database import SessionLocal
from app.models import ElementError, LearningProject, LessonProgress, User

SET_ID = "language-fr-a1"
LESSON = "01-greetings.json"


def _seed(
    db,
    *,
    lesson_mode: str,
    corrected: int,
) -> tuple[str, str]:
    now = datetime.now(UTC)
    user = User(name="Tester", language="en", updated_at=now)
    db.add(user)
    db.flush()
    project = LearningProject(
        user_id=user.id,
        topic="French",
        goal="A1",
        timeframe="3m",
        daily_minutes=30,
        updated_at=now,
    )
    db.add(project)
    db.flush()
    progress = LessonProgress(
        user_id=user.id,
        source="bundled:x",
        set_id=SET_ID,
        lesson_filename=LESSON,
        status="completed",
        lesson_mode=lesson_mode,
        # attempts=2 => not a first-attempt run, so no no-mistakes bonus.
        step_results='{"s0": {"correct": 10, "total": 16, "attempts": 2}}',
        score_correct=10,
        score_total=16,
        time_spent_seconds=120,
        current_step=0,
        started_at=now,
        updated_at=now,
        completed_at=now,
    )
    db.add(progress)
    db.flush()
    for i in range(corrected):
        db.add(
            ElementError(
                user_id=user.id,
                set_id=SET_ID,
                lesson_id=LESSON,
                exercise_id=f"ex-{i:03d}",
                element_key=f"elem-{i:03d}",
                element_type="vocabulary",
                user_answer="",
                correct_answer="",
                error_count=1,
                correct_streak=1,
                last_error_at=now,
                last_attempt_at=now,
                mastered=False,
                created_at=now,
                updated_at=now,
            )
        )
    db.commit()
    return project.id, progress.id


def _award(project_id: str, progress_id: str):
    db = SessionLocal()
    try:
        return award_xp_for_lesson_session(
            db,
            session={
                "project_id": project_id,
                "lesson_progress_id": progress_id,
                "score_correct": 10,
                "score_total": 16,
            },
        )
    finally:
        db.close()


def test_practice_award_scores_on_corrected_final_state() -> None:
    db = SessionLocal()
    try:
        project_id, progress_id = _seed(db, lesson_mode="practice", corrected=6)
    finally:
        db.close()
    award = _award(project_id, progress_id)
    # 10/16 first pass; all 6 wrong elements corrected -> 16/16 -> 3 stars ->
    # base 30 + star_bonus 30 = 60 (no first-attempt bonus, streak 0).
    assert award is not None
    assert award.xp_earned == 60
    assert award.breakdown == {"base": 30, "star_bonus": 30}


def test_practice_award_scores_on_first_pass_when_uncorrected() -> None:
    db = SessionLocal()
    try:
        project_id, progress_id = _seed(db, lesson_mode="practice", corrected=0)
    finally:
        db.close()
    award = _award(project_id, progress_id)
    # 10/16 = 63% -> 1 star -> base 30 + star_bonus 10 = 40.
    assert award is not None
    assert award.xp_earned == 40
    assert award.breakdown == {"base": 30, "star_bonus": 10}


def test_exam_award_ignores_corrections() -> None:
    db = SessionLocal()
    try:
        project_id, progress_id = _seed(db, lesson_mode="exam", corrected=6)
    finally:
        db.close()
    award = _award(project_id, progress_id)
    # exam is first-pass by design: 1 star * 1.5x mode multiplier -> 60,
    # but the star basis stays the first pass (star_bonus 10, not 30).
    assert award is not None
    assert award.breakdown["star_bonus"] == 10
