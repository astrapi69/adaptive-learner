"""Tests for the missions plugin catalog (EXP-010 / Phase 56A)."""

from __future__ import annotations

from adaptive_learner_missions.catalog import get_template, load_templates
from adaptive_learner_missions.schema import (
    MissionCategory,
    MissionDifficulty,
    MissionTemplate,
)

VALID_CATEGORIES = {c.value for c in MissionCategory}
VALID_DIFFICULTIES = {d.value for d in MissionDifficulty}


def test_catalog_loads_and_validates():
    templates = load_templates()
    assert len(templates) >= 20
    assert all(isinstance(t, MissionTemplate) for t in templates)


def test_all_template_ids_unique():
    ids = [t.id for t in load_templates()]
    assert len(ids) == len(set(ids))


def test_every_category_is_represented():
    cats = {t.category.value for t in load_templates()}
    assert cats == VALID_CATEGORIES


def test_every_difficulty_is_represented():
    diffs = {t.difficulty.value for t in load_templates()}
    assert diffs == VALID_DIFFICULTIES


def test_targets_and_rewards_sane():
    for t in load_templates():
        assert t.target_value > 0
        assert t.xp_reward >= 0
        assert t.icon
        assert t.check_function
        assert t.title_key.startswith("missions.templates.")
        assert t.description_key.startswith("missions.templates.")


def test_get_template_known_and_unknown():
    assert get_template("complete-1-lesson") is not None
    assert get_template("does-not-exist") is None


def test_difficulty_buckets_have_entries():
    # The generator picks one easy + one medium + one hard, so each
    # bucket must be non-empty.
    by_diff: dict[str, int] = {}
    for t in load_templates():
        by_diff[t.difficulty.value] = by_diff.get(t.difficulty.value, 0) + 1
    assert by_diff.get("easy", 0) >= 1
    assert by_diff.get("medium", 0) >= 1
    assert by_diff.get("hard", 0) >= 1


# --- Generator (EXP-010 / Phase 56C) -------------------------------------

from adaptive_learner_missions.generator import (  # noqa: E402
    SUPPORTED_CHECK_FUNCTIONS,
    assign_daily_missions,
    eligible_categories,
)

_VETERAN = dict(lessons_completed=60, has_errors=True, is_weekend=False)
_NEW = dict(lessons_completed=0, has_errors=False, is_weekend=False)


def test_eligible_categories_new_vs_active():
    assert eligible_categories(lessons_completed=0, has_errors=False) == {
        "learning",
        "exploration",
    }
    active = eligible_categories(lessons_completed=5, has_errors=True)
    assert {"review", "mastery"}.issubset(active)
    no_err = eligible_categories(lessons_completed=5, has_errors=False)
    assert "review" not in no_err and "mastery" not in no_err


def test_assignment_is_deterministic():
    a = assign_daily_missions("u1", "2026-05-29", **_VETERAN)
    b = assign_daily_missions("u1", "2026-05-29", **_VETERAN)
    assert [t.id for t in a] == [t.id for t in b]


def test_balanced_mix_one_per_difficulty():
    picks = assign_daily_missions("u1", "2026-05-29", **_VETERAN)
    assert sorted(t.difficulty.value for t in picks) == ["easy", "hard", "medium"]


def test_only_supported_checks_assigned():
    for u in ("u1", "u2", "u3", "u4"):
        for t in assign_daily_missions(u, "2026-05-29", **_VETERAN):
            assert t.check_function in SUPPORTED_CHECK_FUNCTIONS


def test_new_user_only_learning_exploration():
    for t in assign_daily_missions("new", "2026-05-29", **_NEW):
        assert t.category.value in {"learning", "exploration"}


def test_no_back_to_back_repeats():
    y = assign_daily_missions("u1", "2026-05-28", **_VETERAN)
    today = assign_daily_missions(
        "u1", "2026-05-29", **_VETERAN, exclude_ids=tuple(t.id for t in y)
    )
    assert not ({t.id for t in today} & {t.id for t in y})


def test_count_respected():
    for n in (1, 2, 3):
        picks = assign_daily_missions("u1", "2026-05-29", **_VETERAN, count=n)
        assert len(picks) == n
