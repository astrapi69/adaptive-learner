#!/usr/bin/env python3
"""Cross-repo content validation for the app repo (issue #47).

Bug #44 was a stale-content drift: the ``adaptive-learner-content``
repo had 16 sets / 330 lessons, but the app's bundled copy + the
content README ("285") were stale. This script makes the content-repo
manifest the single authority and keeps an auto-generated stats block
in the app README in lock-step with it.

**The content repo is the authority, NOT the gitignored bundle.** This
script reads the content-repo manifests DIRECTLY (the same source
``copy-bundled-content.mjs`` bundles), resolved as:

  1. ``ADAPTIVE_LEARNER_CONTENT_DIR`` env var (CI + the bundler use it);
  2. otherwise the sibling checkout ``../adaptive-learner-content``.

It never walks the ephemeral ``frontend/public/content/`` bundle, never
runs the bundler, never mutates the content repo, and does not collide
with the content-repo-side ``docs/ci/.../validate_content.py`` (which
validates lesson SCHEMA inside the content repo).

Modes::

    validate_bundled_content.py --write-readme   # pre-commit: regenerate
    validate_bundled_content.py --check-readme   # CI: exit 1 on drift

Both modes also validate orphans + manifest-vs-filesystem consistency
and exit 1 on any mismatch. When the content repo is not present
locally (a contributor without the sibling checkout), both modes SKIP
with a warning and exit 0 — the real guard is the CI job, which checks
the content repo out fresh.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
# ``VALIDATE_BUNDLED_CONTENT_README`` overrides the README path; used by
# the regression test to point at a temp file. Defaults to the app README.
README_PATH = Path(
    os.environ.get("VALIDATE_BUNDLED_CONTENT_README", str(REPO_ROOT / "README.md"))
)

MARKER_START = "<!-- CONTENT-STATS:START -->"
MARKER_END = "<!-- CONTENT-STATS:END -->"
# The auto-generated block is a subsection under "## What you get".
SUBSECTION_HEADING = "### Bundled Content"
# Where to insert the subsection on first run (before this heading).
INSERT_BEFORE_HEADING = "## Install"


def resolve_content_dir() -> Path | None:
    """Resolve the content-repo checkout, or ``None`` when absent."""
    env = os.environ.get("ADAPTIVE_LEARNER_CONTENT_DIR")
    candidate = (
        Path(env).resolve()
        if env
        else (REPO_ROOT.parent / "adaptive-learner-content").resolve()
    )
    if not candidate.is_dir() or not (candidate / "manifest.yaml").is_file():
        return None
    return candidate


def count_lessons(set_dir: Path) -> int:
    """Count lesson JSON files in ``<set_dir>/lessons`` (the canonical
    filesystem truth). Manifest sidecars are excluded."""
    lessons_dir = set_dir / "lessons"
    if not lessons_dir.is_dir():
        return 0
    return sum(
        1
        for f in lessons_dir.glob("*.json")
        if not f.name.startswith(("manifest", "_meta"))
    )


def collect_stats(content_dir: Path) -> tuple[dict, list[str]]:
    """Read the root manifest + filesystem-walk the sets. Returns
    ``(stats, errors)`` where ``stats`` drives the README block and
    ``errors`` is non-empty on any orphan / manifest mismatch."""
    errors: list[str] = []
    manifest = yaml.safe_load((content_dir / "manifest.yaml").read_text("utf-8"))
    sets = manifest.get("sets") or []
    if not sets:
        errors.append("root manifest.yaml lists no sets")

    rows: list[dict] = []
    manifest_paths: set[str] = set()
    total_lessons = 0
    for entry in sets:
        path = entry.get("path")
        if not path:
            errors.append(f"set {entry.get('id')!r}: missing 'path'")
            continue
        manifest_paths.add(path)
        set_dir = content_dir / path
        actual = count_lessons(set_dir)
        declared = entry.get("lesson_count")
        if declared is not None and declared != actual:
            errors.append(
                f"set {entry.get('id')!r}: manifest lesson_count "
                f"{declared} != {actual} lesson files on disk"
            )
        total_lessons += actual
        rows.append(
            {
                "title": entry.get("title") or entry.get("id") or path,
                "source": entry.get("source_language", "?"),
                "target": entry.get("target_language", "?"),
                "level": entry.get("level", "-"),
                "domain": entry.get("domain", "language"),
                "lessons": actual,
            }
        )

    # Orphan detection: a set dir on disk (has a manifest.yaml) that the
    # root manifest does not list -> invisible to the loader (this is
    # exactly the Bug #44 failure mode).
    sets_dir = content_dir / "sets"
    if sets_dir.is_dir():
        for set_manifest in sets_dir.rglob("manifest.yaml"):
            rel = set_manifest.parent.relative_to(content_dir).as_posix()
            if rel not in manifest_paths:
                errors.append(f"orphan set dir not in root manifest: {rel}")

    domains = sorted({r["domain"] for r in rows})
    stats = {
        "total_lessons": total_lessons,
        "total_sets": len(rows),
        "domains": domains,
        "rows": rows,
    }
    return stats, errors


def render_block(stats: dict) -> str:
    """Render the markdown between the CONTENT-STATS markers."""
    domains = ", ".join(stats["domains"]) or "language"
    lines = [
        MARKER_START,
        f"**{stats['total_lessons']} lessons · {stats['total_sets']} sets · "
        f"{len(stats['domains'])} domain(s)** ({domains}) — bundled offline "
        "into the GitHub Pages build from "
        "[astrapi69/adaptive-learner-content]"
        "(https://github.com/astrapi69/adaptive-learner-content).",
        "",
        "| Set | Source | Target | Level | Lessons |",
        "|-----|--------|--------|-------|--------:|",
    ]
    for row in stats["rows"]:
        lines.append(
            f"| {row['title']} | {row['source']} | {row['target']} | "
            f"{row['level']} | {row['lessons']} |"
        )
    lines.append(MARKER_END)
    return "\n".join(lines)


def _replace_or_insert(readme: str, block: str) -> str:
    """Replace the existing marker block, or insert the subsection
    before the Install section on first run."""
    if MARKER_START in readme and MARKER_END in readme:
        head = readme[: readme.index(MARKER_START)]
        tail = readme[readme.index(MARKER_END) + len(MARKER_END) :]
        return head + block + tail
    subsection = f"{SUBSECTION_HEADING}\n\n{block}\n\n"
    anchor = f"\n{INSERT_BEFORE_HEADING}"
    if anchor in readme:
        idx = readme.index(anchor)
        return readme[:idx] + "\n" + subsection + readme[idx + 1 :]
    return readme.rstrip() + "\n\n" + subsection


def current_block(readme: str) -> str | None:
    if MARKER_START not in readme or MARKER_END not in readme:
        return None
    start = readme.index(MARKER_START)
    end = readme.index(MARKER_END) + len(MARKER_END)
    return readme[start:end]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--write-readme",
        action="store_true",
        help="Regenerate the README CONTENT-STATS block in place.",
    )
    group.add_argument(
        "--check-readme",
        action="store_true",
        help="Read-only; exit 1 if the README block is out of date.",
    )
    args = parser.parse_args()

    content_dir = resolve_content_dir()
    if content_dir is None:
        print(
            "[validate-bundled-content] SKIP: no content checkout "
            "(set ADAPTIVE_LEARNER_CONTENT_DIR or check out "
            "adaptive-learner-content next to this repo). The CI job "
            "checks it out fresh and is the authoritative gate.",
            file=sys.stderr,
        )
        return 0

    stats, errors = collect_stats(content_dir)
    if errors:
        print(
            "[validate-bundled-content] FAIL: content integrity errors:",
            file=sys.stderr,
        )
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    block = render_block(stats)
    readme = README_PATH.read_text("utf-8")

    if args.write_readme:
        updated = _replace_or_insert(readme, block)
        if updated != readme:
            README_PATH.write_text(updated, "utf-8")
            print(
                "[validate-bundled-content] README CONTENT-STATS block "
                f"updated ({stats['total_lessons']} lessons / "
                f"{stats['total_sets']} sets).",
            )
        else:
            print("[validate-bundled-content] README already up to date.")
        return 0

    # --check-readme
    existing = current_block(readme)
    if existing is None:
        print(
            "[validate-bundled-content] FAIL: README is missing the "
            "CONTENT-STATS markers. Run "
            "`python scripts/validate_bundled_content.py --write-readme`.",
            file=sys.stderr,
        )
        return 1
    if existing != block:
        print(
            "[validate-bundled-content] FAIL: README CONTENT-STATS block "
            f"is stale. Content repo has {stats['total_lessons']} lessons "
            f"/ {stats['total_sets']} sets. Run "
            "`python scripts/validate_bundled_content.py --write-readme` "
            "and commit.",
            file=sys.stderr,
        )
        return 1
    print(
        "[validate-bundled-content] OK: README matches the content repo "
        f"({stats['total_lessons']} lessons / {stats['total_sets']} sets)."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
