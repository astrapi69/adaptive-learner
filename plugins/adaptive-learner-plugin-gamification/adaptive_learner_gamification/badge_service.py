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

import json
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
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


def load_catalog_from_yaml() -> list[dict[str, Any]]:
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
        tiers = entry.get("tiers")
        fields = {
            "name_key": entry["name_key"],
            "description_key": entry["description_key"],
            "icon": entry.get("icon", ""),
            "category": entry.get("category", "general"),
            "base_tier": entry.get("base_tier", "bronze"),
            "tier_thresholds": json.dumps(tiers, sort_keys=True) if tiers else None,
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

    return db.query(LearningProfile).filter(LearningProfile.user_id == user_id).first() is not None


def _import_count(db: Session, user_id: str) -> int:
    from app.models import ImportedConversation

    return db.query(ImportedConversation).filter(ImportedConversation.user_id == user_id).count()


def _provider_count(db: Session, user_id: str) -> int:
    """How many providers the user has configured an API key for."""
    from app.models import UserSettings

    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
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


def _last_n_lessons_all_three_star(db: Session, user_id: str, *, n: int = 3) -> bool:
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
    return all(xp_service.compute_stars(row.score_correct, row.score_total) == 3 for row in rows)


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
    settings = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
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
    "three_star_streak": lambda db, uid: _last_n_lessons_all_three_star(db, uid, n=3),
    "review_master": lambda db, uid: _mastered_elements_count(db, uid) >= 50,
}


def evaluator_keys() -> set[str]:
    """Catalog keys that have a registered evaluator."""
    return set(_EVALUATORS.keys())


# ---------------------------------------------------------------------------
# Tier evaluation (Phase 57 / v1.40.0)
# ---------------------------------------------------------------------------

_TIER_ORDER: tuple[str, ...] = ("bronze", "silver", "gold")

# DYNAMIC badges: key -> metric function returning an int the tier
# thresholds compare against. Only siblingless count badges climb
# tiers in place; everything else is a static/flat badge handled by
# the boolean ``_EVALUATORS`` path. MUST match the keys carrying a
# ``tiers:`` block in badges.yaml (a test pins the agreement).
_TIER_METRICS: dict[str, Callable[[Any, str], int]] = {
    "lessons_10": _completed_lesson_count,
    "review_master": _mastered_elements_count,
}


def dynamic_tier_keys() -> set[str]:
    """Catalog keys whose single row upgrades through tiers."""
    return set(_TIER_METRICS.keys())


# Progress metric per catalog badge: ``key -> (metric_fn, required)``.
# ``metric_fn`` returns the user's current value toward the badge; the
# boolean-achievement badges expose a 0/1 metric with ``required = 1``,
# the count/level/streak badges reuse the same helper + threshold the
# evaluator uses. Dynamic-tier badges (lessons_10, review_master) are
# NOT listed here — their ``required`` is the next unearned tier
# threshold, computed in :func:`badge_progress_map`.
_PROGRESS_SPECS: dict[str, tuple[Callable[[Any, str], int], int]] = {
    "first_session": (_completed_session_count, 1),
    "first_assessment": (lambda db, uid: 1 if _has_assessment(db, uid) else 0, 1),
    "first_import": (_import_count, 1),
    "streak_3_days": (_current_streak, 3),
    "streak_7_days": (_current_streak, 7),
    "streak_30_days": (_current_streak, 30),
    "streak_100_days": (_current_streak, 100),
    "all_six_methods": (lambda db, uid: len(_distinct_methods_used(db, uid)), 6),
    "deductive_10": (lambda db, uid: _session_count_for_method(db, uid, "deductive"), 10),
    "inductive_10": (lambda db, uid: _session_count_for_method(db, uid, "inductive"), 10),
    "error_based_10": (lambda db, uid: _session_count_for_method(db, uid, "error_based"), 10),
    "dialogic_10": (lambda db, uid: _session_count_for_method(db, uid, "dialogic"), 10),
    "contextual_10": (lambda db, uid: _session_count_for_method(db, uid, "contextual"), 10),
    "ai_adaptive_10": (lambda db, uid: _session_count_for_method(db, uid, "ai_adaptive"), 10),
    "five_cycles_one_session": (_max_cycle_count_in_one_session, 5),
    "sessions_10": (_completed_session_count, 10),
    "sessions_50": (_completed_session_count, 50),
    "sessions_100": (_completed_session_count, 100),
    "level_5": (_user_level, 5),
    "level_10": (_user_level, 10),
    "level_25": (_user_level, 25),
    "two_languages": (_languages_used, 2),
    "three_providers": (_provider_count, 3),
    "import_10_conversations": (_import_count, 10),
    "first_lesson": (_completed_lesson_count, 1),
    "three_star_streak": (
        lambda db, uid: 1 if _last_n_lessons_all_three_star(db, uid, n=3) else 0,
        1,
    ),
}


def _next_tier_threshold(value: int, thresholds: dict[str, dict[str, int]] | None) -> int:
    """The smallest tier threshold ``value`` has not yet reached.

    Used as the ``required`` for a dynamic-tier badge's progress bar:
    progress toward the next tier, or the top (gold) threshold once the
    metric is maxed out so the bar reads full.
    """
    if not thresholds:
        return max(1, value)
    targets = sorted(spec["threshold"] for spec in thresholds.values())
    for target in targets:
        if value < target:
            return target
    return targets[-1]


def badge_progress_map(db: Session, user_id: str) -> dict[str, dict[str, int]]:
    """Per-badge ``{current, required}`` progress for every catalog key.

    ``current`` is clamped to ``required`` so a consumer can render a
    bar as ``current / required`` without overflow. Dynamic-tier badges
    report progress toward their next unearned tier.
    """
    from app.models import Badge

    out: dict[str, dict[str, int]] = {}
    for key, (metric_fn, required) in _PROGRESS_SPECS.items():
        current = int(metric_fn(db, user_id))
        out[key] = {"current": min(current, required), "required": required}
    for key, metric_fn in _TIER_METRICS.items():
        badge = db.query(Badge).filter(Badge.key == key).first()
        thresholds = (
            json.loads(badge.tier_thresholds) if badge and badge.tier_thresholds else None
        )
        value = int(metric_fn(db, user_id))
        required = _next_tier_threshold(value, thresholds)
        out[key] = {"current": min(value, required), "required": required}
    return out


def _tier_index(tier: str | None) -> int:
    """Ordinal of a tier (bronze=0 < silver=1 < gold=2); -1 if None."""
    return _TIER_ORDER.index(tier) if tier in _TIER_ORDER else -1


def evaluate_badge_tier(value: int, thresholds: dict[str, dict[str, int]]) -> str | None:
    """Highest tier whose ``threshold`` ``value`` meets, else None.

    ``thresholds`` is the decoded ``{tier: {threshold, xp_bonus}}``
    map. Returns the top satisfied tier so a brand-new earn can land
    directly at silver/gold when the metric already exceeds it.
    """
    earned: str | None = None
    for tier in _TIER_ORDER:
        spec = thresholds.get(tier)
        if spec is not None and value >= spec["threshold"]:
            earned = tier
    return earned


def tier_upgrade_xp(
    old_tier: str | None,
    new_tier: str,
    thresholds: dict[str, dict[str, int]],
) -> int:
    """XP to award when moving ``old_tier`` -> ``new_tier``.

    ``xp_bonus`` values are cumulative totals, so the award is the
    DELTA (e.g. bronze->silver awards ``silver - bronze``; a direct
    bronze-skipping first earn at silver awards the full silver
    total). Prevents XP inflation on re-evaluation: the high-water
    ``tier`` column means no further award once a tier is held.
    """
    new_total = thresholds[new_tier]["xp_bonus"]
    old_total = thresholds[old_tier]["xp_bonus"] if old_tier else 0
    return max(0, new_total - old_total)


@dataclass
class TierUpgrade:
    """A badge tier transition produced by an evaluation pass."""

    key: str
    old_tier: str | None
    new_tier: str
    xp_awarded: int


@dataclass
class BadgeEvalResult:
    """Outcome of :func:`evaluate_user`.

    ``earned`` = badge keys that went from absent to present this call
    (includes a dynamic badge's first earn). ``upgrades`` = every tier
    transition (first earn of a dynamic badge AND already-held dynamic
    badges climbing), for the celebration bus.
    """

    earned: list[str] = field(default_factory=list)
    upgrades: list[TierUpgrade] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Evaluation entry point
# ---------------------------------------------------------------------------


def evaluate_user(db: Session, user_id: str) -> BadgeEvalResult:
    """Run every evaluator against the user; insert/upgrade rows.

    Returns a :class:`BadgeEvalResult` with newly-earned keys AND tier
    upgrades. Static/flat badges insert once at their fixed base tier;
    dynamic badges (lessons_10, review_master) earn at the highest
    satisfied tier and climb (high-water mark, never demote) on later
    passes, awarding the XP delta on each transition. Existing earns
    are NOT re-inserted (unique constraint on
    ``(user_id, badge_id)`` would catch it anyway, but we skip
    explicitly to avoid the DB error path).
    """
    from app.models import Badge, UserBadge

    from . import xp_service

    result = BadgeEvalResult()
    # Map key -> Badge for the catalog (single query). We need
    # ``base_tier`` so a newly-earned static sibling (sessions_50 =
    # silver, ...) records its fixed tier, and ``tier_thresholds`` for
    # the dynamic-tier path.
    catalog = {b.key: b for b in db.query(Badge).all()}
    # Already-earned rows for this user, keyed by badge_id (one query).
    earned_rows = {
        row.badge_id: row for row in db.query(UserBadge).filter(UserBadge.user_id == user_id).all()
    }
    dirty = False
    for key, predicate in _EVALUATORS.items():
        badge = catalog.get(key)
        if badge is None:
            # Catalog row missing — happens in tests that skip
            # seeding. Just log and continue.
            logger.debug("evaluate_user: catalog missing badge key %r", key)
            continue
        existing = earned_rows.get(badge.id)
        metric_fn = _TIER_METRICS.get(key)
        thresholds = json.loads(badge.tier_thresholds) if badge.tier_thresholds else None
        try:
            if metric_fn is not None and thresholds is not None:
                # DYNAMIC badge: compute the metric, derive the target
                # tier, then earn-at-tier or high-water upgrade.
                value = metric_fn(db, user_id)
                target = evaluate_badge_tier(value, thresholds)
                if target is None:
                    continue
                if existing is None:
                    db.add(UserBadge(user_id=user_id, badge_id=badge.id, tier=target))
                    xp = tier_upgrade_xp(None, target, thresholds)
                    result.earned.append(key)
                    result.upgrades.append(TierUpgrade(key, None, target, xp))
                    dirty = True
                elif _tier_index(target) > _tier_index(existing.tier):
                    old = existing.tier
                    existing.tier = target  # onupdate bumps updated_at
                    xp = tier_upgrade_xp(old, target, thresholds)
                    result.upgrades.append(TierUpgrade(key, old, target, xp))
                    dirty = True
            else:
                # STATIC / flat badge: boolean predicate, record at the
                # badge's fixed base tier.
                if existing is not None:
                    continue
                if predicate(db, user_id):
                    db.add(
                        UserBadge(
                            user_id=user_id,
                            badge_id=badge.id,
                            tier=badge.base_tier,
                        )
                    )
                    result.earned.append(key)
                    dirty = True
        except Exception:  # noqa: BLE001
            logger.exception(
                "Badge evaluator for %r raised - skipping this evaluation.",
                key,
            )
    if dirty:
        db.commit()
    # Award tier-upgrade XP after the badge rows commit. ``award_xp_flat``
    # manages its own commit; the high-water ``tier`` already persisted
    # guards against re-award on a later evaluation (Q-122).
    for upgrade in result.upgrades:
        if upgrade.xp_awarded > 0:
            xp_service.award_xp_flat(
                db,
                user_id=user_id,
                amount=upgrade.xp_awarded,
                reason="badge_tier_upgrade",
            )
    return result


# ---------------------------------------------------------------------------
# Read-side: catalog + per-user state for the dashboard showcase
# ---------------------------------------------------------------------------


def list_badges_with_progress(db: Session, user_id: str) -> list[dict[str, Any]]:
    """Return every catalog badge plus its earned-state for this user.

    Output ordered by category (alphabetical) then by catalog key
    so the showcase has a stable per-render layout.
    """
    from app.models import Badge, UserBadge

    badges = db.query(Badge).order_by(Badge.category.asc(), Badge.key.asc()).all()
    earned_map: dict[str, Any] = {}
    for row in db.query(UserBadge).filter(UserBadge.user_id == user_id).all():
        earned_map[row.badge_id] = row
    out: list[dict[str, Any]] = []
    for badge in badges:
        earned_row = earned_map.get(badge.id)
        earned_at = earned_row.earned_at if earned_row else None
        # The user's tier is their earned tier when earned, else the
        # badge's locked/base tier (so the gallery can preview a locked
        # badge in its starting palette).
        tier = earned_row.tier if earned_row else badge.base_tier
        out.append(
            {
                "key": badge.key,
                "name_key": badge.name_key,
                "description_key": badge.description_key,
                "icon": badge.icon,
                "category": badge.category,
                "base_tier": badge.base_tier,
                "tier": tier,
                "tier_thresholds": (
                    json.loads(badge.tier_thresholds) if badge.tier_thresholds else None
                ),
                "earned": earned_at is not None,
                "earned_at": earned_at.isoformat() if earned_at else None,
                "progress": None,
            }
        )
    return out
