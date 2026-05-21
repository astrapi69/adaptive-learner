"""Pure-unit tests for the badge YAML bundle (Phase 29B).

DB-touching evaluation tests live in
``backend/tests/test_gamification_badges_integration.py``.
"""

from __future__ import annotations

from adaptive_learner_gamification import badge_service


def test_yaml_loads_with_expected_count() -> None:
    catalog = badge_service.load_catalog_from_yaml()
    # Phase 29B spec: 20-30 badges. We shipped 24 in v1.16.0
    # (3 getting_started + 4 consistency + 7 method_explorer +
    # 7 depth + 3 polyglot).
    assert len(catalog) == 24


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
