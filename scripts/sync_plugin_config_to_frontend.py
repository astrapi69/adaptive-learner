#!/usr/bin/env python3
"""Regenerate ``frontend/src/data/plugin-config/*.json`` from
``backend/config/plugins/*.yaml`` (Phase 49 / v1.32.0 / PHASE-42-
STORAGE-ABSTRACTION-01).

The JSON files are the source of truth for the
``DexieStorage.pluginSettings.get`` defaults path: when a plugin
settings row doesn't exist in IndexedDB yet, DexieStorage falls
back to the bundled YAML's ``settings:`` block. The YAMLs stay
the canonical authoring surface (operator edits in
``backend/config/plugins/{name}.yaml`` work the same way for
API-mode users).

Mirrors the existing ``sync_i18n_to_frontend.py`` pattern. Run
after editing any backend plugin YAML. A Vitest pin
(``frontend/src/data/plugin-config/plugin-config-sync.test.ts``)
catches drift in CI so a missed regeneration fails the build
instead of silently shipping the wrong defaults to GH Pages
users.

Output shape: each ``{name}.yaml``'s ``settings`` mapping is
unwrapped and written as the top level of ``{name}.json``. This
matches what
``api.pluginSettings.get({name}) -> {plugin, settings}`` returns
on the API side, so the Dexie default and the API response have
the same shape after one ``.settings`` access. Files without a
``settings`` block (e.g. content-loader, which only carries
``cache_max_set_size_mb`` keys at the top level) emit ``{}``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "backend" / "config" / "plugins"
DST = REPO / "frontend" / "src" / "data" / "plugin-config"


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    changed = 0
    for yaml_path in sorted(SRC.glob("*.yaml")):
        name = yaml_path.stem
        data = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
        # Unwrap the ``settings:`` block when present so the JSON
        # shape matches what callers get back from ``settings``
        # on the API-side response payload. Plugins without a
        # ``settings:`` block emit ``{}`` — the consumer can
        # still call ``get`` and merge against an empty default.
        settings = data.get("settings") if isinstance(data, dict) else None
        if not isinstance(settings, dict):
            settings = {}
        out = DST / f"{name}.json"
        new = json.dumps(settings, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
        if out.exists() and out.read_text(encoding="utf-8") == new:
            print(f"  {name}: in sync")
            continue
        out.write_text(new, encoding="utf-8")
        print(f"  {name}: regenerated")
        changed += 1
    print(f"Done. {changed} plugin config(s) changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
