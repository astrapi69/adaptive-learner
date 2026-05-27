"""Badge catalog seeding + evaluation (Phase 29B / v1.16.0).

Two responsibilities:

1. **Seed the catalog** on first startup from ``badges.yaml``.
   Idempotent on the ``key`` slug — re-running on every boot is
   safe; existing rows update only when the YAML changed.

2. **Evaluate eligibility** after each XP-earning action. The
   evaluator scans the catalog, checks each badge's condition
   against the user's current state, and inserts any newly-earned
   ``user_badges`` rows. Returns the list of badge keys that were
   awarded in this call so the route layer can surface a "badge
   earned" toast.

Conditions are evaluated by name; the dispatcher in
``_EVALUATORS`` is a dict of ``key -> callable(db, user_id) ->
bool``. Adding a new badge means appending a YAML entry AND a
matching entry in ``_EVALUATORS``; the seed loader fails loud if
the two drift.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

import yaml

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Catalog seeding
# ---------------------------------------------------------------------------


def _badges_yaml_path() -> Path:
    return Path(__file__).resolve().parent / "badges.yaml"


def load_catalog_from_yaml() -> list[dict[str, str]]:
    """Read ``badges.yaml`` and return the badge dict list.

    Raises FileNotFoundError if the bundle is broken; the route
    layer never calls this directly so seed-time loud failure is
    the right shape.
    """
    raw = yaml.safe_load(_badges_yaml_path().read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("badges.yaml: top-level must be a mapping")
    badges = raw.get("badges") or []
    if not isinstance(badges, list):
        raise ValueError("badges.yaml: 'badges' must be a list")
    return badges


def seed_catalog(db: Session) -> int:
    """Insert / update catalog rows from YAML. Idempotent.

    Returns the number of rows that were inserted OR updated
    (existing-and-unchanged rows are skipped). Designed to run
    from the FastAPI lifespan AFTER ``init_db`` so the schema is
    present.
    """
    from app.models import Badge

    catalog = load_catalog_from_yaml()
    inserted = 0
    for entry in catalog:
        key = entry["key"]
        existing = db.query(Badge).filter(Badge.key == key).first()
        fields = {
            "name_key": entry["name_key"],
            "description_key": entry["description_key"],
            "icon": entry.get("icon", ""),
            "category": entry.get("category", "general"),
        }
        if existing is None:
            db.add(Badge(key=key, **fields))
            inserted += 1
        else:
            dirty = False
            for k, v in fields.items():
                if getattr(existing, k) != v:
                    setattr(existing, k, v)
                    dirty = True
            if dirty:
                inserted += 1
    db.commit()
    return inserted


# ---------------------------------------------------------------------------
# Evaluators (predicate per badge key)
# ---------------------------------------------------------------------------


def _completed_session_count(db: Session, user_id: str) -> int:
    from app.models import LearningProject, LearningSession

    return (
        db.query(LearningSession)
        .join(LearningProject, LearningSession.project_id == LearningProject.id)
        .filter(LearningProject.user_id == user_id)
        .filter(LearningSession.status == "completed")
        .count()
    )


def _session_count_for_method(db: Session, user_id: str, method: str) -> int:
    from app.models import LearningProject, LearningSession

    return (
        db.query(LearningSession)
        .join(LearningProject, LearningSession.project_id == LearningProject.id)
        .filter(LearningProject.user_id == user_id)
        .filter(LearningSession.method == method)
        .filter(LearningSession.status == "completed")
        .count()
    )


def _distinct_methods_used(db: Session, user_id: str) -> set[str]:
    from app.models import LearningProject, LearningSession

    rows = (
        db.query(LearningSession.method)
        .join(LearningProject, LearningSession.project_id == LearningProject.id)
        .filter(LearningProject.user_id == user_id)
        .filter(LearningSession.status == "completed")
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def _max_cycle_count_in_one_session(db: Session, user_id: str) -> int:
    from app.models import LearningProject, LearningSession

    row = (
        db.query(LearningSession.cycle_count)
        .join(LearningProject, LearningSession.project_id == LearningProject.id)
        .filter(LearningProject.user_id == user_id)
        .order_by(LearningSession.cycle_count.desc())
        .first()
    )
    return int(row[0]) if row and row[0] is not None else 0


def _current_streak(db: Session, user_id: str) -> int:
    from . import xp_service

    activity = xp_service._activity_dates_for_user(db, user_id)
    return xp_service.current_streak_days(activity)


def _user_level(db: Session, user_id: str) -> int:
    from app.models import UserXP

    row = db.query(UserXP).filter(UserXP.user_id == user_id).first()
    return int(row.level) if row else 1


def _has_assessment(db: Session, user_id: str) -> bool:
    from app.models import LearningProfile

    return (
        db.query(LearningProfile)
        .filter(LearningProfile.user_id == user_id)
        .first()
        is not None
    )


def _import_count(db: Session, user_id: str) -> int:
    from app.models import ImportedConversation

    return (
        db.query(ImportedConversation)
        .filter(ImportedConversation.user_id == user_id)
        .count()
    )


def _provider_count(db: Session, user_id: str) -> int:
    """How many providers the user has configured an API key for."""
    from app.models import UserSettings

    settings = (
        db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    )
    if settings is None:
        return 0
    return sum(
        1
        for v in (
            settings.api_key_anthropic,
            settings.api_key_openai,
            settings.api_key_gemini,
        )
        if v
    )


def _completed_lesson_count(db: Session, user_id: str) -> int:
    """Count LessonProgress rows the user has flipped to ``completed``.

    Counted off ``lesson_progress.status`` rather than
    ``LearningSession(method="content")`` because LessonProgress
    is the authoritative completion record — a user with a
    completed lesson but no LearningSession (rare; happens
    only if the 46F.2 unification fails) still earned the
    badge.
    """
    from app.models import LessonProgress

    return (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user_id)
        .filter(LessonProgress.status == "completed")
        .count()
    )


def _last_n_lessons_all_three_star(
    db: Session, user_id: str, *, n: int = 3
) -> bool:
    """True iff the last ``n`` completed lessons all earned 3 stars.

    Reads the user's most-recently-completed LessonProgress rows
    ordered by ``completed_at`` desc, projects each to the same
    star band the 46E.1 XP rule uses (``compute_stars``), and
    returns True iff every one of the top ``n`` rows hits 3.
    Returns False when the user has fewer than ``n`` completions.
    """
    from app.models import LessonProgress

    from . import xp_service

    rows = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user_id)
        .filter(LessonProgress.status == "completed")
        .order_by(LessonProgress.completed_at.desc())
        .limit(n)
        .all()
    )
    if len(rows) < n:
        return False
    return all(
        xp_service.compute_stars(row.score_correct, row.score_total) == 3
        for row in rows
    )


def _mastered_elements_count(db: Session, user_id: str) -> int:
    """Count of ``ElementError`` rows where ``mastered=True`` for this user.

    Element-level mastery is the v1.30.0 SRS exit criterion
    (3 consecutive correct attempts flips ``mastered``;
    failing a mastered element demotes it). The 50-element
    threshold for the Review Master badge IS that count.
    """
    from app.models import ElementError

    return (
        db.query(ElementError)
        .filter(ElementError.user_id == user_id)
        .filter(ElementError.mastered.is_(True))
        .count()
    )


def _languages_used(db: Session, user_id: str) -> int:
    """Distinct languages across the user's curricula + own setting.

    A loose definition — the spec just wants "Learned in 2 Languages",
    so we count the union of (User.language) + (UserSettings.language)
    + every curriculum.language the user owns.
    """
    from app.models import Curriculum, User, UserSettings

    langs: set[str] = set()
    user = db.get(User, user_id)
    if user and user.language:
        langs.add(user.language)
    settings = (
        db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    )
    if settings and settings.language:
        langs.add(settings.language)
    rows = db.query(Curriculum.language).filter(Curriculum.user_id == user_id).all()
    for row in rows:
        if row[0]:
            langs.add(row[0])
    return len(langs)


# Predicate map. Key MUST match badges.yaml ``key`` exactly.
_EVALUATORS: dict[str, Callable[[Any, str], bool]] = {
    "first_session": lambda db, uid: _completed_session_count(db, uid) >= 1,
    "first_assessment": lambda db, uid: _has_assessment(db, uid),
    "first_import": lambda db, uid: _import_count(db, uid) >= 1,
    "streak_3_days": lambda db, uid: _current_streak(db, uid) >= 3,
    "streak_7_days": lambda db, uid: _current_streak(db, uid) >= 7,
    "streak_30_days": lambda db, uid: _current_streak(db, uid) >= 30,
    "streak_100_days": lambda db, uid: _current_streak(db, uid) >= 100,
    "all_six_methods": lambda db, uid: len(_distinct_methods_used(db, uid)) >= 6,
    "deductive_10": lambda db, uid: _session_count_for_method(db, uid, "deductive") >= 10,
    "inductive_10": lambda db, uid: _session_count_for_method(db, uid, "inductive") >= 10,
    "error_based_10": lambda db, uid: _session_count_for_method(db, uid, "error_based") >= 10,
    "dialogic_10": lambda db, uid: _session_count_for_method(db, uid, "dialogic") >= 10,
    "contextual_10": lambda db, uid: _session_count_for_method(db, uid, "contextual") >= 10,
    "ai_adaptive_10": lambda db, uid: _session_count_for_method(db, uid, "ai_adaptive") >= 10,
    "five_cycles_one_session": lambda db, uid: _max_cycle_count_in_one_session(db, uid) >= 5,
    "sessions_10": lambda db, uid: _completed_session_count(db, uid) >= 10,
    "sessions_50": lambda db, uid: _completed_session_count(db, uid) >= 50,
    "sessions_100": lambda db, uid: _completed_session_count(db, uid) >= 100,
    "level_5": lambda db, uid: _user_level(db, uid) >= 5,
    "level_10": lambda db, uid: _user_level(db, uid) >= 10,
    "level_25": lambda db, uid: _user_level(db, uid) >= 25,
    "two_languages": lambda db, uid: _languages_used(db, uid) >= 2,
    "three_providers": lambda db, uid: _provider_count(db, uid) >= 3,
    "import_10_conversations": lambda db, uid: _import_count(db, uid) >= 10,
    # --- Content lessons (Phase 46E.2 / v1.31.0) -----------------
    "first_lesson": lambda db, uid: _completed_lesson_count(db, uid) >= 1,
    "lessons_10": lambda db, uid: _completed_lesson_count(db, uid) >= 10,
    "three_star_streak": lambda db, uid: _last_n_lessons_all_three_star(
        db, uid, n=3
    ),
    "review_master": lambda db, uid: _mastered_elements_count(db, uid) >= 50,
}


def evaluator_keys() -> set[str]:
    """Catalog keys that have a registered evaluator."""
    return set(_EVALUATORS.keys())


# ---------------------------------------------------------------------------
# Evaluation entry point
# ---------------------------------------------------------------------------


def evaluate_user(db: Session, user_id: str) -> list[str]:
    """Run every evaluator against the user; insert newly-earned rows.

    Returns the list of badge KEYS earned in this call. Existing
    earns are NOT re-inserted (unique constraint on
    ``(user_id, badge_id)`` would catch it anyway, but we skip
    explicitly to avoid the DB error path).
    """
    from app.models import Badge, UserBadge

    earned_in_this_call: list[str] = []
    # Map key -> badge_id for the catalog (single query).
    catalog = {b.key: b.id for b in db.query(Badge).all()}
    # Already-earned badge_ids for this user (one query).
    already_earned = {
        row.badge_id
        for row in db.query(UserBadge).filter(UserBadge.user_id == user_id).all()
    }
    for key, predicate in _EVALUATORS.items():
        badge_id = catalog.get(key)
        if badge_id is None:
            # Catalog row missing — happens in tests that skip
            # seeding. Just log and continue.
            logger.debug("evaluate_user: catalog missing badge key %r", key)
            continue
        if badge_id in already_earned:
            continue
        try:
            if predicate(db, user_id):
                db.add(UserBadge(user_id=user_id, badge_id=badge_id))
                earned_in_this_call.append(key)
        except Exception:  # noqa: BLE001
            logger.exception(
                "Badge evaluator for %r raised — skipping this evaluation.",
                key,
            )
    if earned_in_this_call:
        db.commit()
    return earned_in_this_call


# ---------------------------------------------------------------------------
# Read-side: catalog + per-user state for the dashboard showcase
# ---------------------------------------------------------------------------


def list_badges_with_progress(db: Session, user_id: str) -> list[dict[str, Any]]:
    """Return every catalog badge plus its earned-state for this user.

    Output ordered by category (alphabetical) then by catalog key
    so the showcase has a stable per-render layout.
    """
    from app.models import Badge, UserBadge

    badges = (
        db.query(Badge).order_by(Badge.category.asc(), Badge.key.asc()).all()
    )
    earned_map: dict[str, Any] = {}
    for row in (
        db.query(UserBadge).filter(UserBadge.user_id == user_id).all()
    ):
        earned_map[row.badge_id] = row.earned_at
    out: list[dict[str, Any]] = []
    for badge in badges:
        earned_at = earned_map.get(badge.id)
        out.append(
            {
                "key": badge.key,
                "name_key": badge.name_key,
                "description_key": badge.description_key,
                "icon": badge.icon,
                "category": badge.category,
                "earned": earned_at is not None,
                "earned_at": earned_at.isoformat() if earned_at else None,
                "progress": None,
            }
        )
    return out
