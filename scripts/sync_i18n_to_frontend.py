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

It also writes the first-paint subset (#3378): every key listed in
``frontend/src/i18n/shell-keys.json``, for every catalog, into
``frontend/src/data/i18n/first-paint/catalogs.json`` (a subfolder, so the per-language catalog glob does not read it as a language). The shell paints from
that subset before the language chunk loads, so it is generated from the
YAML instead of hand-copied (the copies had drifted and covered 5 of 11
languages). A listed key missing from a catalog fails the run.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "backend" / "config" / "i18n"
DST = REPO / "frontend" / "src" / "data" / "i18n"
SHELL_KEYS = REPO / "frontend" / "src" / "i18n" / "shell-keys.json"
SHELL_OUT = REPO / "frontend" / "src" / "data" / "i18n" / "first-paint" / "catalogs.json"


def _lookup(catalog: dict, key: str) -> str | None:
    node: object = catalog
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None


def _shell_subset(catalog: dict, keys: list[str], lang: str) -> dict:
    """Nested subset of ``catalog`` holding exactly ``keys``; exits on a gap."""
    subset: dict = {}
    for key in keys:
        value = _lookup(catalog, key)
        if value is None:
            raise SystemExit(f"shell key {key!r} missing from the {lang} catalog")
        *parents, leaf = key.split(".")
        node = subset
        for part in parents:
            node = node.setdefault(part, {})
        node[leaf] = value
    return subset


def _write_if_changed(path: Path, text: str, label: str) -> int:
    if path.exists() and path.read_text(encoding="utf-8") == text:
        print(f"  {label}: in sync")
        return 0
    path.write_text(text, encoding="utf-8")
    print(f"  {label}: regenerated")
    return 1


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    changed = 0
    shell_keys = json.loads(SHELL_KEYS.read_text(encoding="utf-8"))
    shell: dict[str, dict] = {}
    for yaml_path in sorted(SRC.glob("*.yaml")):
        lang = yaml_path.stem
        data = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        new = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
        changed += _write_if_changed(DST / f"{lang}.json", new, lang)
        shell[lang] = _shell_subset(data, shell_keys, lang)
    shell_text = json.dumps(shell, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    changed += _write_if_changed(SHELL_OUT, shell_text, "first-paint subset")
    print(f"Done. {changed} catalog(s) changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
