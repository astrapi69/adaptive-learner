"""Cross-language badge-catalog parity (Phase 61 follow-up).

The badge catalog is defined twice: ``badges.yaml`` (Python / API
mode) and ``frontend/src/storage/badges-data.ts`` (TypeScript /
Dexie mode). Tier EVALUATION is already pinned cross-language
(``tests/fixtures/badge-tier-parity/input.json``); this pins the
CATALOG itself.

Both sources must match the frozen golden at
``tests/fixtures/badge-catalog/catalog.json``. A badge added, or a
``base_tier`` / threshold changed, on one side without the other
fails the build instead of silently diverging API-mode and
Dexie-mode users (the "two installation paths diverge" failure
class). The TS half lives at
``frontend/src/storage/badge-catalog.parity.test.ts``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML

REPO_ROOT = Path(__file__).resolve().parents[3]
GOLDEN = REPO_ROOT / "tests" / "fixtures" / "badge-catalog" / "catalog.json"
BADGES_YAML = (
    REPO_ROOT
    / "plugins"
    / "adaptive-learner-plugin-gamification"
    / "adaptive_learner_gamification"
    / "badges.yaml"
)


def _normalize_yaml() -> list[dict[str, Any]]:
    """badges.yaml entries normalised into the golden's shape:
    ``base_tier`` defaults to "bronze"; the YAML's ``tiers`` block
    becomes ``tier_thresholds`` (None for static badges)."""
    yaml = YAML(typ="safe")
    data = yaml.load(BADGES_YAML.read_text(encoding="utf-8"))
    return [
        {
            "key": entry["key"],
            "name_key": entry["name_key"],
            "description_key": entry["description_key"],
            "icon": entry["icon"],
            "category": entry["category"],
            "base_tier": entry.get("base_tier", "bronze"),
            "tier_thresholds": entry.get("tiers"),
        }
        for entry in data["badges"]
    ]


def test_badges_yaml_matches_golden() -> None:
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    actual = _normalize_yaml()

    assert len(actual) == len(golden) == 28, "badge count drifted from the golden"
    assert {e["key"] for e in actual} == {e["key"] for e in golden}, (
        "badges.yaml keys differ from the golden catalog"
    )

    golden_by_key = {e["key"]: e for e in golden}
    for entry in actual:
        assert entry == golden_by_key[entry["key"]], (
            f"badge {entry['key']!r} in badges.yaml drifted from the golden "
            f"catalog; regenerate the golden or fix the YAML"
        )
