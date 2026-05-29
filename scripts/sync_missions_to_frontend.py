#!/usr/bin/env python3
"""Regenerate ``frontend/src/data/missions/templates.json`` from the
missions plugin catalog ``templates.yaml`` (EXP-010 / Phase 56).

The JSON is what the frontend mission generator reads at runtime in
BOTH storage modes (Dexie client-side assignment needs the catalog
without an API roundtrip). The plugin YAML stays the canonical
authoring surface; a Vitest drift pin
(``frontend/src/data/missions/missions-sync.test.ts``) fails the
build if a regeneration is missed.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent
SRC = (
    REPO
    / "plugins"
    / "adaptive-learner-plugin-missions"
    / "adaptive_learner_missions"
    / "templates.yaml"
)
DST = REPO / "frontend" / "src" / "data" / "missions" / "templates.json"


def main() -> int:
    DST.parent.mkdir(parents=True, exist_ok=True)
    raw = yaml.safe_load(SRC.read_text(encoding="utf-8"))
    templates = raw.get("templates", []) if isinstance(raw, dict) else []
    new = json.dumps(
        {"templates": templates}, ensure_ascii=False, indent=2, sort_keys=False
    )
    new += "\n"
    if DST.exists() and DST.read_text(encoding="utf-8") == new:
        print("missions: in sync")
        return 0
    DST.write_text(new, encoding="utf-8")
    print(f"missions: regenerated {len(templates)} template(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
