"""Pure-unit tests for the badge YAML bundle (Phase 29B).

DB-touching evaluation tests live in
``backend/tests/test_gamification_badges_integration.py``.
"""

from __future__ import annotations

from adaptive_learner_gamification import badge_service


def test_yaml_loads_with_expected_count() -> None:
    catalog = badge_service.load_catalog_from_yaml()
    # Phase 29B spec: 20-30 badges. v1.16.0 shipped 24
    # (3 getting_started + 4 consistency + 7 method_explorer +
    # 7 depth + 3 polyglot). v1.31.0 / Phase 46E.2 adds 4
    # content-lesson badges (+1 getting_started + 1 consistency +
    # 2 depth) for 28 total.
    assert len(catalog) == 28


def test_every_yaml_entry_has_required_fields() -> None:
    catalog = badge_service.load_catalog_from_yaml()
    for entry in catalog:
        assert "key" in entry and entry["key"]
        assert "name_key" in entry and entry["name_key"]
        assert "description_key" in entry and entry["description_key"]
        # icon + category have defaults but must be present.
        assert "icon" in entry
        assert "category" in entry


def test_no_duplicate_keys() -> None:
    catalog = badge_service.load_catalog_from_yaml()
    keys = [e["key"] for e in catalog]
    assert len(keys) == len(set(keys))


def test_every_yaml_key_has_a_predicate() -> None:
    catalog = {e["key"] for e in badge_service.load_catalog_from_yaml()}
    evaluators = badge_service.evaluator_keys()
    assert catalog == evaluators, (
        "Catalog / evaluator drift — keys differ:\n"
        f"  catalog-only: {sorted(catalog - evaluators)}\n"
        f"  evaluator-only: {sorted(evaluators - catalog)}"
    )


def test_categories_match_the_spec() -> None:
    """Spec lists 5 categories; pin them so an inadvertent rename
    of a YAML category doesn't drift away from the i18n catalog
    key under ``gamification.badge_category.*``."""
    catalog = badge_service.load_catalog_from_yaml()
    categories = {e["category"] for e in catalog}
    expected = {
        "getting_started",
        "consistency",
        "method_explorer",
        "depth",
        "polyglot",
    }
    assert categories == expected


# --- Tier metadata (Phase 57 / v1.40.0) -----------------------------------

_VALID_TIERS = {"bronze", "silver", "gold"}

# Pin the static visual-tier map for the sibling families. Keys NOT
# listed here MUST default to "bronze". This is the single
# human-readable spec the migration backfill (Alembic 0022
# ``_SILVER_KEYS`` / ``_GOLD_KEYS``) and the Dexie v21 upgrade mirror.
_EXPECTED_NON_BRONZE_BASE_TIER = {
    "sessions_50": "silver",
    "sessions_100": "gold",
    "level_10": "silver",
    "level_25": "gold",
    "streak_7_days": "silver",
    "streak_30_days": "gold",
    "streak_100_days": "gold",
}

# Badges whose single row UPGRADES through tiers (have a ``tiers`` block).
_EXPECTED_DYNAMIC = {"lessons_10", "review_master"}


def test_base_tier_values_are_valid() -> None:
    catalog = badge_service.load_catalog_from_yaml()
    for entry in catalog:
        base_tier = entry.get("base_tier", "bronze")
        assert base_tier in _VALID_TIERS, (
            f"{entry['key']}: base_tier {base_tier!r} not in {_VALID_TIERS}"
        )


def test_sibling_base_tier_map_is_exact() -> None:
    """Exactly the 7 sibling keys carry a non-bronze base_tier; every
    other badge is bronze. Guards the gallery's bronze->silver->gold
    grouping + the migration backfill against drift."""
    catalog = badge_service.load_catalog_from_yaml()
    non_bronze = {
        e["key"]: e["base_tier"] for e in catalog if e.get("base_tier", "bronze") != "bronze"
    }
    assert non_bronze == _EXPECTED_NON_BRONZE_BASE_TIER


def test_dynamic_badges_have_wellformed_tiers() -> None:
    """Only the siblingless count badges carry a ``tiers`` block, and
    each block has bronze/silver/gold with strictly increasing
    thresholds AND xp_bonus."""
    catalog = badge_service.load_catalog_from_yaml()
    with_tiers = {e["key"] for e in catalog if e.get("tiers")}
    assert with_tiers == _EXPECTED_DYNAMIC
    for entry in catalog:
        tiers = entry.get("tiers")
        if not tiers:
            continue
        assert set(tiers) == _VALID_TIERS, (
            f"{entry['key']}: tiers keys {set(tiers)} != {_VALID_TIERS}"
        )
        thresholds = [tiers[t]["threshold"] for t in ("bronze", "silver", "gold")]
        xp = [tiers[t]["xp_bonus"] for t in ("bronze", "silver", "gold")]
        assert thresholds == sorted(thresholds) and len(set(thresholds)) == 3, (
            f"{entry['key']}: thresholds not strictly increasing: {thresholds}"
        )
        assert xp == sorted(xp) and len(set(xp)) == 3, (
            f"{entry['key']}: xp_bonus not strictly increasing: {xp}"
        )


def test_migration_backfill_map_matches_yaml() -> None:
    """The Alembic 0022 static sibling map MUST match the YAML
    base_tier values, or an upgrade-in-place user's backfilled tier
    drifts from a fresh seed. Loads the migration by path (its module
    name starts with a digit, so it can't be imported normally)."""
    import importlib.util
    from pathlib import Path

    mig_path = (
        Path(__file__).resolve().parents[3]
        / "backend"
        / "migrations"
        / "versions"
        / "0022_badge_tiers.py"
    )
    spec = importlib.util.spec_from_file_location("mig0022", mig_path)
    assert spec and spec.loader
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)

    from_migration = {k: "silver" for k in mig._SILVER_KEYS}
    from_migration.update({k: "gold" for k in mig._GOLD_KEYS})
    assert from_migration == _EXPECTED_NON_BRONZE_BASE_TIER
