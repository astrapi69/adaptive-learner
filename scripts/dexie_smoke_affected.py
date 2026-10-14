#!/usr/bin/env python3
"""Decide whether a pull request runs the Dexie-mode smoke (#3748).

The smoke (``.github/workflows/dexie-smoke.yml``) builds the frontend with
``VITE_STORAGE_MODE=dexie`` and runs ``e2e/dexie/`` against it. On a pull
request it runs when a changed file is something that build or those specs
read, and reports "not affected" otherwise.

Why the trigger is all of ``frontend/`` and not a list of folders: measured
on 2026-10-14 with V8 block coverage over the Dexie specs (177 tests, mapped
back to ``frontend/src`` through the build's source maps), the specs execute
1002 of 1342 non-test modules (75 percent). The 340 they do not execute are
spread thinly: only 40 sit in directories the specs never reach, 17 of those
are type-only modules, and the largest such directory has 6 files. A folder
list carved from that would save almost nothing and would go stale the day a
spec reaches one more module. So: ``frontend/**`` minus what never ships
(unit tests, their setup, the mutation-test config), plus what the specs and
the build read outside it.

Fail closed: when the diff cannot be computed, or comes back empty, the smoke
runs. "Could not look" is never "nothing to run".

Usage (CI)::

    python3 scripts/dexie_smoke_affected.py --base origin/develop \\
        --github-output "$GITHUB_OUTPUT"
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from dataclasses import dataclass, field
from fnmatch import fnmatch
from pathlib import Path

# Directory prefixes whose files the Dexie build or specs read.
RELEVANT_PREFIXES: tuple[str, ...] = (
    "frontend/",
    # The frontend imports schema/content-manifest.schema.json.
    "schema/",
    "e2e/dexie/",
    "e2e/dexie-setup/",
    "e2e/helpers/",
    "e2e/fixtures/",
)

# Single files outside those prefixes the specs or the workflow read.
RELEVANT_FILES: frozenset[str] = frozenset(
    {
        "e2e/visual/helpers.ts",
        "e2e/package.json",
        "e2e/bun.lock",
        "e2e/playwright.dexie.config.ts",
        "e2e/.runtime-skip-budget.json",
        "scripts/check_e2e_skip_budget.py",
        "scripts/dexie_smoke_affected.py",
        ".github/workflows/dexie-smoke.yml",
    }
)

# Inside frontend/: what never reaches the built app.
NEVER_SHIPPED: tuple[str, ...] = (
    "frontend/*.test.ts",
    "frontend/*.test.tsx",
    "frontend/src/test/*",
    "frontend/stryker.config.json",
)


@dataclass
class Decision:
    """Whether the smoke runs, and on what evidence."""

    affected: bool
    checked: int
    relevant: list[str] = field(default_factory=list)


def is_relevant(path: str) -> bool:
    """True when the Dexie build or its specs read ``path``."""
    if path in RELEVANT_FILES:
        return True
    if not path.startswith(RELEVANT_PREFIXES):
        return False
    return not any(fnmatch(path, pattern) for pattern in NEVER_SHIPPED)


def decide(changed: list[str]) -> Decision:
    """Decide on a list of changed paths; an empty list fails closed."""
    relevant = [path for path in changed if is_relevant(path)]
    return Decision(affected=bool(relevant) or not changed, checked=len(changed), relevant=relevant)


def changed_files(repo: Path, base: str) -> list[str] | None:
    """Files changed on HEAD since its merge base with ``base``, or None."""
    try:
        diff = subprocess.run(
            ["git", "-C", str(repo), "diff", "--name-only", f"{base}...HEAD"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as err:
        detail = err.stderr.strip() if isinstance(err, subprocess.CalledProcessError) else err
        print(f"::warning::git diff against {base} failed ({detail}); running the smoke")
        return None
    return [line for line in diff.stdout.splitlines() if line.strip()]


def report(decision: Decision) -> None:
    """Print what was looked at, so "0 relevant" and "0 checked" differ."""
    verdict = "affected" if decision.affected else "not affected"
    print(
        f"Dexie smoke {verdict}: {len(decision.relevant)} of {decision.checked} "
        "changed files are read by the Dexie build or its specs"
    )
    for path in decision.relevant:
        print(f"  {path}")
    if decision.checked == 0:
        print("::warning::no changed files found; running the smoke")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--base", required=True, help="base ref, e.g. origin/develop")
    parser.add_argument("--repo", default=".", help="repository root (default: cwd)")
    parser.add_argument("--github-output", help="file to append affected=true|false to")
    args = parser.parse_args(argv)

    changed = changed_files(Path(args.repo), args.base)
    decision = decide(changed) if changed is not None else Decision(affected=True, checked=0)
    if changed is not None:
        report(decision)
    if args.github_output:
        with open(args.github_output, "a", encoding="utf-8") as out:
            out.write(f"affected={'true' if decision.affected else 'false'}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
