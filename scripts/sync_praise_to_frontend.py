#!/usr/bin/env python3
"""Regenerate ``frontend/src/data/praise/*.json`` from
``backend/config/praise/*.yaml`` (EXP-008 / Phase 55A).

The JSON files are the source of truth at runtime - the
frontend's praise ``phrase-picker`` imports them via
``import.meta.glob`` so no API roundtrip is required, in either
storage mode. The YAMLs stay the canonical authoring surface.

A dedicated directory (NOT ``config/help``) keeps the praise
bundles out of the ``help-glossary`` glob, which expects a
different bundle shape.

A Vitest pin
(``frontend/src/data/praise/praise-sync.test.ts``) catches drift
in CI so a missed regeneration fails the build instead of
silently shipping stale phrases to users.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "backend" / "config" / "praise"
DST = REPO / "frontend" / "src" / "data" / "praise"


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    changed = 0
    for yaml_path in sorted(SRC.glob("*.yaml")):
        lang = yaml_path.stem
        data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        out = DST / f"{lang}.json"
        new = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
        if out.exists() and out.read_text(encoding="utf-8") == new:
            print(f"  {lang}: in sync")
            continue
        out.write_text(new, encoding="utf-8")
        print(f"  {lang}: regenerated")
        changed += 1
    print(f"Done. {changed} catalog(s) changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
