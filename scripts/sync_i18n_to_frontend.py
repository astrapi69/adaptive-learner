#!/usr/bin/env python3
"""Regenerate ``frontend/src/data/i18n/*.json`` from
``backend/config/i18n/*.yaml`` (Phase 29F follow-up).

The JSON files are the source of truth at runtime in Dexie mode
(github-pages, no backend); ``DexieStorage.i18n.get`` imports
them via ``import.meta.glob``. The YAMLs stay the canonical
authoring surface.

Run this script after editing any backend i18n YAML. A Vitest
pin (``frontend/src/data/i18n/i18n-sync.test.ts``) catches drift
in CI so a missed regeneration fails the build instead of
silently shipping raw keys to GH Pages users.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "backend" / "config" / "i18n"
DST = REPO / "frontend" / "src" / "data" / "i18n"


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
