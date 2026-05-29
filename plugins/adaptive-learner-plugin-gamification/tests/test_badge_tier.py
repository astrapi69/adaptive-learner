"""Badge-tier pure-function tests + cross-language parity (Phase 57).

Pins :func:`badge_service.evaluate_badge_tier` +
:func:`badge_service.tier_upgrade_xp` against the shared golden at
``tests/fixtures/badge-tier-parity/input.json`` so the Python and
TypeScript (frontend/src/storage/badges.ts) tier rules stay
byte-identical. The TS half lives at
``frontend/src/lib/gamification/badge-tier.parity.test.ts``.
"""

from __future__ import annotations

import json
from pathlib import Path

from adaptive_learner_gamification import badge_service

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE = REPO_ROOT / "tests" / "fixtures" / "badge-tier-parity" / "input.json"


def _fixture() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def _thresholds(data: dict, ref: str) -> dict[str, dict[str, int]]:
    return data[ref]


def test_evaluate_badge_tier_matches_golden() -> None:
    data = _fixture()
    for case in data["evaluate_tier_cases"]:
        thresholds = _thresholds(data, case["thresholds_ref"])
        got = badge_service.evaluate_badge_tier(case["value"], thresholds)
        assert got == case["expected_tier"], (
            f"{case['name']}: evaluate_badge_tier({case['value']}) = {got!r}, "
            f"expected {case['expected_tier']!r}"
        )


def test_tier_upgrade_xp_matches_golden() -> None:
    data = _fixture()
    for case in data["upgrade_xp_cases"]:
        thresholds = _thresholds(data, case["thresholds_ref"])
        got = badge_service.tier_upgrade_xp(case["old_tier"], case["new_tier"], thresholds)
        assert got == case["expected_xp"], (
            f"{case['name']}: tier_upgrade_xp({case['old_tier']!r} -> "
            f"{case['new_tier']!r}) = {got}, expected {case['expected_xp']}"
        )


def test_dynamic_tier_keys_match_yaml_threshold_blocks() -> None:
    """The dynamic-metric registry MUST cover exactly the badges that
    carry a ``tiers:`` block in the YAML — a drift would leave a
    dynamic badge stuck at bronze or crash the metric lookup."""
    catalog = badge_service.load_catalog_from_yaml()
    with_thresholds = {e["key"] for e in catalog if e.get("tiers")}
    assert badge_service.dynamic_tier_keys() == with_thresholds


def test_tier_never_demotes_is_monotonic_helper() -> None:
    """``_tier_index`` orders bronze < silver < gold and None lowest,
    the invariant the high-water upgrade guard relies on."""
    assert (
        badge_service._tier_index(None)
        < badge_service._tier_index("bronze")
        < badge_service._tier_index("silver")
        < badge_service._tier_index("gold")
    )
