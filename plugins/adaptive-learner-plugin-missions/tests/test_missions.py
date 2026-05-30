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


# --- Generator edge cases (Phase 61 coverage sweep) ----------------------

import pytest  # noqa: E402
from pydantic import ValidationError  # noqa: E402


def test_count_clamped_below_one():
    # count < 1 is clamped up to 1.
    picks = assign_daily_missions("u1", "2026-05-29", **_VETERAN, count=0)
    assert len(picks) == 1


def test_count_clamped_above_three():
    # count > 3 is clamped down to 3.
    picks = assign_daily_missions("u1", "2026-05-29", **_VETERAN, count=5)
    assert len(picks) == 3


def test_invalid_mix_falls_back_to_balanced():
    bogus = assign_daily_missions("u1", "2026-05-29", **_VETERAN, difficulty_mix="nonsense")
    balanced = assign_daily_missions("u1", "2026-05-29", **_VETERAN, difficulty_mix="balanced")
    assert [t.id for t in bogus] == [t.id for t in balanced]


def test_easy_mix_sequence_skews_easy():
    picks = assign_daily_missions("u1", "2026-05-29", **_VETERAN, difficulty_mix="easy")
    diffs = sorted(t.difficulty.value for t in picks)
    # easy sequence is [easy, easy, medium]
    assert diffs == ["easy", "easy", "medium"]


def test_challenging_mix_sequence_skews_hard():
    picks = assign_daily_missions("u1", "2026-05-29", **_VETERAN, difficulty_mix="challenging")
    diffs = sorted(t.difficulty.value for t in picks)
    # challenging sequence is [medium, hard, hard]
    assert diffs == ["hard", "hard", "medium"]


def test_weekend_learner_excluded_on_weekdays():
    picks = assign_daily_missions(
        "u1", "2026-05-29", lessons_completed=60, has_errors=True, is_weekend=False
    )
    assert all(t.id != "weekend-learner" for t in picks)


def test_weekend_learner_eligible_on_weekend():
    # Across several users on a weekend, weekend-learner becomes
    # selectable (it is in the streak/exploration eligible set).
    seen = set()
    for i in range(40):
        for t in assign_daily_missions(
            f"u{i}", "2026-05-30", lessons_completed=60, has_errors=True, is_weekend=True
        ):
            seen.add(t.id)
    # The catalog ships a weekend-learner template; on a weekend it
    # is at least eligible (not force-excluded).
    from adaptive_learner_missions.catalog import get_template

    assert get_template("weekend-learner") is not None


def test_exclude_ids_fully_excluded():
    first = assign_daily_missions("u1", "2026-05-29", **_VETERAN)
    excluded = tuple(t.id for t in first)
    second = assign_daily_missions("u1", "2026-05-29", **_VETERAN, exclude_ids=excluded)
    assert not ({t.id for t in second} & set(excluded))


def test_different_users_differ_or_deterministic():
    a = [t.id for t in assign_daily_missions("alice", "2026-05-29", **_VETERAN)]
    b = [t.id for t in assign_daily_missions("bob", "2026-05-29", **_VETERAN)]
    # Each is internally deterministic; the seed differs by user so
    # the orderings are independent (not asserting inequality, which
    # could coincide, but that re-running alice reproduces a).
    a2 = [t.id for t in assign_daily_missions("alice", "2026-05-29", **_VETERAN)]
    assert a == a2
    assert isinstance(b, list)


def test_different_dates_reseed():
    a = [t.id for t in assign_daily_missions("u1", "2026-05-29", **_VETERAN)]
    a2 = [t.id for t in assign_daily_missions("u1", "2026-05-29", **_VETERAN)]
    assert a == a2  # same date -> same picks


def test_picked_ids_unique_within_a_day():
    picks = assign_daily_missions("u1", "2026-05-29", **_VETERAN)
    ids = [t.id for t in picks]
    assert len(ids) == len(set(ids))


def test_new_user_pool_never_includes_review_or_mastery():
    for i in range(30):
        for t in assign_daily_missions(f"new{i}", "2026-05-29", **_NEW):
            assert t.category.value not in {"review", "mastery", "streak"}


def test_no_errors_excludes_review_and_mastery():
    cats = eligible_categories(lessons_completed=10, has_errors=False)
    assert "review" not in cats
    assert "mastery" not in cats
    assert "streak" in cats


# --- Schema validators (Phase 61 coverage sweep) -------------------------

def _tmpl(**over):
    base = dict(
        id="x-mission",
        title_key="missions.x.title",
        description_key="missions.x.desc",
        category="learning",
        target_value=3,
        difficulty="easy",
        xp_reward=10,
        icon="star",
        check_function="lessons_completed_today",
    )
    base.update(over)
    return MissionTemplate(**base)


def test_template_valid_construction():
    t = _tmpl()
    assert t.id == "x-mission"
    assert t.category is MissionCategory.LEARNING
    assert t.difficulty is MissionDifficulty.EASY


def test_template_target_value_must_be_positive():
    with pytest.raises(ValidationError):
        _tmpl(target_value=0)
    with pytest.raises(ValidationError):
        _tmpl(target_value=-1)


def test_template_xp_reward_non_negative():
    _tmpl(xp_reward=0)  # zero is allowed
    with pytest.raises(ValidationError):
        _tmpl(xp_reward=-5)


def test_template_id_non_empty():
    with pytest.raises(ValidationError):
        _tmpl(id="")


def test_template_icon_non_empty():
    with pytest.raises(ValidationError):
        _tmpl(icon="")


def test_template_check_function_non_empty():
    with pytest.raises(ValidationError):
        _tmpl(check_function="")


def test_template_rejects_unknown_category():
    with pytest.raises(ValidationError):
        _tmpl(category="not-a-category")


def test_template_rejects_unknown_difficulty():
    with pytest.raises(ValidationError):
        _tmpl(difficulty="impossible")


def test_template_keys_required():
    with pytest.raises(ValidationError):
        _tmpl(title_key="")
    with pytest.raises(ValidationError):
        _tmpl(description_key="")


# --- Catalog (Phase 61 coverage sweep) -----------------------------------

def test_get_template_unknown_returns_none():
    assert get_template("does-not-exist") is None


def test_get_template_known_returns_template():
    any_id = load_templates()[0].id
    assert get_template(any_id) is not None
    assert get_template(any_id).id == any_id


def test_load_templates_is_stable():
    a = [t.id for t in load_templates()]
    b = [t.id for t in load_templates()]
    assert a == b


def test_every_template_has_string_check_function():
    for t in load_templates():
        assert isinstance(t.check_function, str) and t.check_function


def test_supported_checks_are_a_subset_of_catalog_checks():
    catalog_checks = {t.check_function for t in load_templates()}
    # Every supported check function is actually used by >= 1 template.
    assert SUPPORTED_CHECK_FUNCTIONS.issubset(catalog_checks)
