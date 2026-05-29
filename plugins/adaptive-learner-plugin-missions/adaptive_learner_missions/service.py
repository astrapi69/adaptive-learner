"""Daily mission service - backend (EXP-010 / Phase 56C).

Assigns + evaluates daily missions against EXISTING data
(LessonProgress / ElementError / UserStreak), mirroring the Dexie
client-side path. Idempotent per day via the UNIQUE constraint on
(user_id, template_id, assigned_date).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ElementError, LessonProgress, UserMission, UserStreak, UserXP

from .catalog import get_template
from .generator import assign_daily_missions

# Parity with frontend/src/lib/missions/progress.ts.


def _utc_today() -> str:
    return datetime.now(UTC).date().isoformat()


def _is_weekend(iso: str) -> bool:
    return date.fromisoformat(iso).weekday() >= 5  # 5=Sat, 6=Sun


def _compute_stars(correct: int, total: int) -> int:
    if total <= 0:
        return 0
    pct = correct / total * 100
    if pct >= 90:
        return 3
    if pct >= 75:
        return 2
    if pct >= 50:
        return 1
    return 0


def _same_day(value: datetime | None, iso: str) -> bool:
    if value is None:
        return False
    return value.date().isoformat() == iso


def _gather_profile(db: Session, user_id: str, today: str) -> dict[str, Any]:
    lessons_completed = (
        db.query(LessonProgress)
        .filter(
            LessonProgress.user_id == user_id,
            LessonProgress.status == "completed",
        )
        .count()
    )
    active_errors = (
        db.query(ElementError)
        .filter(
            ElementError.user_id == user_id,
            ElementError.mastered.is_(False),
        )
        .count()
    )
    xp = db.scalar(select(UserXP).where(UserXP.user_id == user_id))
    return {
        "lessons_completed": lessons_completed,
        "has_errors": active_errors > 0,
        "level": xp.level if xp else 1,
        "is_weekend": _is_weekend(today),
    }


def _gather_stats(db: Session, user_id: str, today: str) -> dict[str, int]:
    lessons = list(db.scalars(select(LessonProgress).where(LessonProgress.user_id == user_id)))
    errors = list(db.scalars(select(ElementError).where(ElementError.user_id == user_id)))
    streak = db.scalar(select(UserStreak).where(UserStreak.user_id == user_id))

    completed_today = [
        r for r in lessons if r.status == "completed" and _same_day(r.completed_at, today)
    ]
    started_sets = {r.set_id for r in lessons if _same_day(r.started_at, today)}
    minutes = (
        sum(r.time_spent_seconds or 0 for r in lessons if _same_day(r.updated_at, today)) // 60
    )
    reviewed = sum(1 for r in errors if _same_day(r.last_attempt_at, today))
    mastered = sum(1 for r in errors if r.mastered and _same_day(r.mastered_at, today))
    lessons_completed_today = len(completed_today)
    active_today = 1 if lessons_completed_today > 0 else 0

    def min_stars(min_value: int) -> int:
        return sum(
            1
            for r in completed_today
            if _compute_stars(r.score_correct, r.score_total) >= min_value
        )

    return {
        "lessons_completed_today": lessons_completed_today,
        "lessons_min_2_stars_today": min_stars(2),
        "lessons_min_3_stars_today": min_stars(3),
        "new_sets_started_today": len(started_sets),
        "elements_reviewed_today": reviewed,
        "review_sessions_completed_today": 0,
        "overdue_cleared_today": 0,
        "elements_mastered_today": mastered,
        "perfect_lessons_today": sum(
            1 for r in completed_today if r.score_total > 0 and r.score_correct == r.score_total
        ),
        "adaptive_lessons_started_today": 0,
        "cloze_exercises_today": 0,
        "exercise_types_used_today": 0,
        "minutes_learned_today": minutes,
        "streak_kept_today": active_today,
        "current_streak_days": streak.current_streak_days if streak else 0,
        "weekend_learning_today": 1 if _is_weekend(today) and active_today else 0,
    }


_DIFFICULTY_RANK = {"easy": 0, "medium": 1, "hard": 2}


def _display_order(mission: dict[str, Any]) -> tuple[int, str]:
    """Stable widget order: easy -> medium -> hard, then id."""
    difficulty = mission["template"]["difficulty"]
    return (_DIFFICULTY_RANK.get(difficulty, 9), mission["template_id"])


def _to_daily(row: UserMission) -> dict[str, Any] | None:
    template = get_template(row.template_id)
    if template is None:
        return None
    return {
        "id": row.id,
        "template_id": row.template_id,
        "assigned_date": row.assigned_date.isoformat(),
        "progress": row.progress,
        "target": template.target_value,
        "completed": row.completed,
        "xp_awarded": row.xp_awarded,
        "template": template.model_dump(mode="json"),
    }


def _assign_for_day(
    db: Session,
    user_id: str,
    today: str,
    *,
    count: int,
    difficulty_mix: str,
) -> list[UserMission]:
    profile = _gather_profile(db, user_id, today)
    yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()
    y_rows = list(
        db.scalars(
            select(UserMission).where(
                UserMission.user_id == user_id,
                UserMission.assigned_date == date.fromisoformat(yesterday),
            )
        )
    )
    templates = assign_daily_missions(
        user_id,
        today,
        lessons_completed=profile["lessons_completed"],
        has_errors=profile["has_errors"],
        is_weekend=profile["is_weekend"],
        count=count,
        difficulty_mix=difficulty_mix,
        exclude_ids=tuple(r.template_id for r in y_rows),
    )
    rows = [
        UserMission(
            user_id=user_id,
            template_id=t.id,
            assigned_date=date.fromisoformat(today),
            progress=0,
            completed=False,
            xp_awarded=False,
        )
        for t in templates
    ]
    for row in rows:
        db.add(row)
    db.flush()
    return rows


def get_daily(
    db: Session,
    user_id: str,
    *,
    count: int = 3,
    difficulty_mix: str = "balanced",
    today_iso: str | None = None,
) -> dict[str, list[dict[str, Any]]]:
    today = today_iso or _utc_today()
    today_date = date.fromisoformat(today)
    rows = list(
        db.scalars(
            select(UserMission).where(
                UserMission.user_id == user_id,
                UserMission.assigned_date == today_date,
            )
        )
    )
    if not rows:
        rows = _assign_for_day(db, user_id, today, count=count, difficulty_mix=difficulty_mix)

    stats = _gather_stats(db, user_id, today)
    newly_completed: list[dict[str, Any]] = []
    now = datetime.now(UTC)
    for row in rows:
        template = get_template(row.template_id)
        if template is None:
            continue
        raw = stats.get(template.check_function, 0)
        row.progress = max(0, min(raw, template.target_value))
        if raw >= template.target_value and not row.completed:
            row.completed = True
            row.completed_at = now
            dm = _to_daily(row)
            if dm:
                newly_completed.append(dm)
        # Award the bonus XP once per completed mission (idempotent
        # via xp_awarded). Lazy import keeps the missions plugin's
        # own env free of a hard gamification dependency.
        if row.completed and not row.xp_awarded and template.xp_reward > 0:
            try:
                from adaptive_learner_gamification.xp_service import (
                    award_xp_flat,
                )

                award_xp_flat(
                    db,
                    user_id=user_id,
                    amount=template.xp_reward,
                    reason=f"mission:{template.id}",
                )
                row.xp_awarded = True
            except Exception:  # noqa: BLE001 - XP is supplementary
                pass
    db.commit()

    missions = [dm for r in rows if (dm := _to_daily(r)) is not None]
    missions.sort(key=_display_order)
    return {"missions": missions, "newly_completed": newly_completed}


def regenerate(
    db: Session,
    user_id: str,
    *,
    count: int = 3,
    difficulty_mix: str = "balanced",
    today_iso: str | None = None,
) -> dict[str, list[dict[str, Any]]]:
    today = today_iso or _utc_today()
    today_date = date.fromisoformat(today)
    for row in db.scalars(
        select(UserMission).where(
            UserMission.user_id == user_id,
            UserMission.assigned_date == today_date,
        )
    ):
        db.delete(row)
    db.commit()
    return get_daily(
        db,
        user_id,
        count=count,
        difficulty_mix=difficulty_mix,
        today_iso=today_iso,
    )
