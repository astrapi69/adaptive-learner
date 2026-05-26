#!/usr/bin/env python3
"""Validate the pilot content against the Content-Loader schema.

Run from the repo root:

    python docs/explorations/sample-content/fr-a1/validate.py

Exits 0 on full validation success, non-zero with the
Pydantic / parser error on the first failure. This is the
canonical CI check the future
``astrapi69/adaptive-learner-content`` repo will mirror on
every PR (a small GitHub Actions workflow runs this script
against the repo's content tree).

The script imports from the installed Content-Loader plugin
so a manifest / lesson author can run it locally without
copy-pasting validation code.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Make the plugin importable when running from the repo
# root. In the public content repo this whole import block
# is replaced by ``pip install adaptive-learner-plugin-content-loader``
# inside the GitHub Actions workflow.
REPO_ROOT = Path(__file__).resolve().parents[3]
PLUGIN_PKG = (
    REPO_ROOT
    / "plugins"
    / "adaptive-learner-plugin-content-loader"
)
sys.path.insert(0, str(PLUGIN_PKG))

from adaptive_learner_content_loader.manifest_parser import (  # noqa: E402
    parse_lesson_json,
    parse_manifest_yaml,
)


def main() -> int:
    here = Path(__file__).parent
    repo_manifest = (here / "manifest.yaml").read_text(encoding="utf-8")
    parsed = parse_manifest_yaml(repo_manifest)
    print(f"OK  manifest.yaml ({len(parsed.sets)} set(s))")

    for content_set in parsed.sets:
        set_dir = here / "sets" / content_set.id
        set_manifest = (set_dir / "manifest.yaml").read_text(encoding="utf-8")
        parse_manifest_yaml(set_manifest)
        print(f"OK  sets/{content_set.id}/manifest.yaml")

        for lesson_path in sorted((set_dir / "lessons").glob("*.json")):
            payload = lesson_path.read_text(encoding="utf-8")
            lesson = parse_lesson_json(payload)
            print(
                f"OK  sets/{content_set.id}/lessons/{lesson_path.name}"
                f" — {lesson.title!r}, {len(lesson.cards)} cards,"
                f" {len(lesson.steps)} steps"
            )

    print("\nAll content validates against schema v1.0.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
