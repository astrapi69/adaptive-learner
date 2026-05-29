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
