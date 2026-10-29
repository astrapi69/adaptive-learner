#!/usr/bin/env python3
"""Resolve the commit range a pull_request run checks, deep enough to be true (#3884).

The CI checkout is shallow. ``origin/<base>..<head>`` lists only the PR's own
commits while the walk from the head meets the base inside the fetched
history. A hotfix branch is cut from main and carries main's whole history,
so with a depth-200 fetch the walk ran past develop's cut: it listed 2389
commits instead of 10, and the rule-change-log check reported 14 old
declarations as missing (#3883).

The range is wrong exactly when it contains a shallow root, because then the
history that separates the PR's commits from the base is missing. This
script fetches both ends at ``--depth`` and, only when the range reaches a
shallow root, fetches their full history. A root still in the range after
that fails closed. The range goes to stdout, the reasons to stderr.

Usage::

    python3 scripts/resolve_pr_range.py --base develop --head <sha>

Exit codes: 0 range printed / 1 a fetch failed or the range is still cut.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def git(root: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"git {' '.join(args)} failed: {result.stderr.strip()}", file=sys.stderr)
        raise SystemExit(1)
    return result.stdout


def shallow_roots(root: Path) -> set[str]:
    """The commits whose parents the clone lacks; empty for a complete clone."""
    path = Path(git(root, "rev-parse", "--git-path", "shallow").strip())
    if not path.is_absolute():
        path = root / path
    if not path.exists():
        return set()
    return set(path.read_text(encoding="utf-8").split())


def reaches_shallow_root(root: Path, rev_range: str) -> bool:
    """Whether walking ``rev_range`` ran into the end of the fetched history."""
    roots = shallow_roots(root)
    return bool(roots) and not roots.isdisjoint(git(root, "rev-list", rev_range).split())


def fetch(root: Path, remote: str, base: str, head: str, depth: int | None) -> None:
    """Fetch ``base`` and ``head`` at ``depth``, or their full history for ``None``."""
    depth_arg = "--unshallow" if depth is None else f"--depth={depth}"
    git(root, "fetch", "--no-tags", depth_arg, remote, base, head)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="base branch, e.g. develop")
    parser.add_argument("--head", required=True, help="PR head commit sha")
    parser.add_argument("--remote", default="origin")
    parser.add_argument("--depth", type=int, default=200)
    args = parser.parse_args()

    root = Path.cwd()
    rev_range = f"{args.remote}/{args.base}..{args.head}"
    fetch(root, args.remote, args.base, args.head, args.depth)
    if reaches_shallow_root(root, rev_range):
        print(
            f"{rev_range} reaches the end of the depth-{args.depth} history; "
            "fetching the full history of both ends",
            file=sys.stderr,
        )
        fetch(root, args.remote, args.base, args.head, None)
        if reaches_shallow_root(root, rev_range):
            print(f"{rev_range} is still cut after the full fetch", file=sys.stderr)
            return 1
    print(rev_range)
    return 0


if __name__ == "__main__":
    sys.exit(main())
