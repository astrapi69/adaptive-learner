#!/usr/bin/env python3
"""Regenerate ``frontend/src/data/help/*.json`` from
``backend/config/help/*.yaml`` (Phase 38).

The JSON files are the source of truth at runtime — the
frontend's ``HelpTooltip`` + ``HelpDrawer`` import them via
``import.meta.glob`` so no API roundtrip is required, in either
storage mode. The YAMLs stay the canonical authoring surface.

A Vitest pin (``frontend/src/data/help/help-sync.test.ts``)
catches drift in CI so a missed regeneration fails the build
instead of silently shipping stale content to users.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "backend" / "config" / "help"
DST = REPO / "frontend" / "src" / "data" / "help"


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    changed = 0
    for yaml_path in sorted(SRC.glob("*.yaml")):
        stem = yaml_path.stem  # e.g. "concepts.de"
        data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        out = DST / f"{stem}.json"
        new = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
        if out.exists() and out.read_text(encoding="utf-8") == new:
            print(f"  {stem}: in sync")
            continue
        out.write_text(new, encoding="utf-8")
        print(f"  {stem}: regenerated")
        changed += 1
    print(f"Done. {changed} bundle(s) changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
