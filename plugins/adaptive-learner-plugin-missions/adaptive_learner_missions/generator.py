"""Daily mission generator - backend (EXP-010 / Phase 56C).

Same algorithm shape as ``frontend/src/lib/missions/generator.ts``:
deterministic per (user_id, date, mix) via a seeded PRNG, adaptive
category eligibility, one pick per difficulty slot, no back-to-back
repeats, only assignable (trackable) checks.

The PRNG differs from the TS one (Python ``random.Random`` vs JS
mulberry32), so exact cross-backend selection is NOT guaranteed -
it does not need to be: a given user uses ONE storage backend
(Dexie OR a shared API DB), and within each backend assignment is
deterministic + idempotent. "Same missions across devices" holds
via the seed (Dexie) or the shared row (API).
"""

from __future__ import annotations

import random

from .catalog import load_templates
from .schema import MissionTemplate

# Parity with frontend/src/lib/missions/checks.ts.
SUPPORTED_CHECK_FUNCTIONS: frozenset[str] = frozenset(
    {
        "lessons_completed_today",
        "lessons_min_2_stars_today",
        "lessons_min_3_stars_today",
        "new_sets_started_today",
        "elements_reviewed_today",
        "elements_mastered_today",
        "perfect_lessons_today",
        "minutes_learned_today",
        "streak_kept_today",
        "current_streak_days",
        "weekend_learning_today",
    }
)

_DIFFICULTY_SEQUENCES: dict[str, list[str]] = {
    "balanced": ["easy", "medium", "hard"],
    "easy": ["easy", "easy", "medium"],
    "challenging": ["medium", "hard", "hard"],
}


def eligible_categories(*, lessons_completed: int, has_errors: bool) -> set[str]:
    if lessons_completed == 0:
        return {"learning", "exploration"}
    cats = {"learning", "exploration", "streak"}
    if has_errors:
        cats.add("review")
        cats.add("mastery")
    return cats


def assign_daily_missions(
    user_id: str,
    date_iso: str,
    *,
    lessons_completed: int,
    has_errors: bool,
    is_weekend: bool,
    count: int = 3,
    difficulty_mix: str = "balanced",
    exclude_ids: tuple[str, ...] = (),
) -> list[MissionTemplate]:
    count = max(1, min(3, count))
    mix = difficulty_mix if difficulty_mix in _DIFFICULTY_SEQUENCES else "balanced"
    exclude = set(exclude_ids)
    rng = random.Random(f"{user_id}:{date_iso}:{mix}")

    cats = eligible_categories(lessons_completed=lessons_completed, has_errors=has_errors)
    eligible = [
        t
        for t in load_templates()
        if t.check_function in SUPPORTED_CHECK_FUNCTIONS
        and t.category.value in cats
        and t.id not in exclude
        and not (t.id == "weekend-learner" and not is_weekend)
    ]

    sequence = _DIFFICULTY_SEQUENCES[mix][:count]
    picked: list[MissionTemplate] = []
    picked_ids: set[str] = set()

    def pick_from(pool: list[MissionTemplate]) -> MissionTemplate | None:
        for t in pool:
            if t.id not in picked_ids:
                return t
        return None

    for difficulty in sequence:
        order = list(eligible)
        rng.shuffle(order)
        chosen = pick_from([t for t in order if t.difficulty.value == difficulty]) or pick_from(
            order
        )
        if chosen is not None:
            picked.append(chosen)
            picked_ids.add(chosen.id)

    return picked
