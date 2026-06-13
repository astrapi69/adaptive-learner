#!/usr/bin/env python3
"""File-size watcher: warn on source files over the line threshold.

Guards against new god-files creeping back in after the #353 cleanup.
WARN-ONLY by design: it emits GitHub Actions ``::warning::`` annotations
(visible in the PR) and a summary, and always exits 0 — it never blocks a
merge. A file legitimately over the threshold (a single-file domain model,
a data/template catalog) goes on the whitelist instead of being split.

Scope: ``*.py`` / ``*.ts`` / ``*.tsx`` under backend/, plugins/, and
frontend/src/, excluding tests, specs, node_modules, and generated trees.

Usage:
    python3 scripts/check_file_sizes.py          # warn-only (CI + local)
    python3 scripts/check_file_sizes.py --strict # exit 1 if any over (opt-in)
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

THRESHOLD = 500

ROOTS = ("backend", "plugins", "frontend/src")
SUFFIXES = (".py", ".ts", ".tsx")

# Paths (repo-root-relative, POSIX) that are allowed to exceed the
# threshold: single-file-by-convention domain models + data/template
# catalogs. A new entry here is a deliberate, reviewed decision.
WHITELIST: frozenset[str] = frozenset(
    {
        "backend/app/models/__init__.py",
        "backend/app/schemas/__init__.py",
        "plugins/adaptive-learner-plugin-assessment/adaptive_learner_assessment/questions.py",
        "plugins/adaptive-learner-plugin-session/adaptive_learner_session/prompts.py",
    }
)

# Path fragments that mark a file as out of scope (tests, generated, deps).
EXCLUDE_FRAGMENTS = (
    "/node_modules/",
    "/tests/",
    "/__pycache__/",
    "/migrations/versions/",
    "/dist/",
)


def _excluded(rel: str) -> bool:
    if rel in WHITELIST:
        return True
    if any(frag in f"/{rel}" for frag in EXCLUDE_FRAGMENTS):
        return True
    name = rel.rsplit("/", 1)[-1]
    return name.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")) or (
        name.startswith("test_") and name.endswith(".py")
    )


def _count_lines(path: Path) -> int:
    with path.open("rb") as fh:
        return sum(1 for _ in fh)


def _iter_source_files(repo_root: Path):
    for root in ROOTS:
        base = repo_root / root
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix not in SUFFIXES:
                continue
            rel = path.relative_to(repo_root).as_posix()
            if _excluded(rel):
                continue
            yield rel, path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 when any file exceeds the threshold (default: warn-only).",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    offenders: list[tuple[str, int]] = []
    for rel, path in _iter_source_files(repo_root):
        count = _count_lines(path)
        if count > THRESHOLD:
            offenders.append((rel, count))

    offenders.sort(key=lambda item: item[1], reverse=True)
    in_ci = os.environ.get("GITHUB_ACTIONS") == "true"
    for rel, count in offenders:
        message = (
            f"{rel} is {count} lines (> {THRESHOLD}). Consider splitting it "
            f"into a focused module (see #353); whitelist it in "
            f"scripts/check_file_sizes.py if it is intentionally large."
        )
        if in_ci:
            print(f"::warning file={rel},line=1::{message}")
        else:
            print(f"WARN: {message}")

    if offenders:
        print(
            f"\n{len(offenders)} file(s) over {THRESHOLD} lines "
            f"(warn-only; {len(WHITELIST)} whitelisted)."
        )
    else:
        print(f"All source files within {THRESHOLD} lines (excl. whitelist).")

    return 1 if (args.strict and offenders) else 0


if __name__ == "__main__":
    sys.exit(main())
