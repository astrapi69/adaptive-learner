#!/usr/bin/env python3
"""Keep dependency directories out of the Docker build context (#2112).

`bun run build` died inside the frontend stage on

    ENOENT: stat '/frontend/public/content/adaptive-learner-content/
                  node_modules/.bin/learn-content-engine'

The link is not broken on the machine - it points ABSOLUTELY into a
sibling repo, so it resolves locally and dangles in the container, where
the target is outside the build context. `.dockerignore` excluded exactly
`frontend/node_modules` and therefore missed every nested one.

A green build proves nothing here: it also passes when the directory
simply is not present that day. So this checks the CONTEXT, and reports
how many paths it examined - a scan that walked nothing must not look
like a clean one (gate contract point 4, quality-checks.md).

Stdlib only: it implements the `.dockerignore` subset this repo uses
(plain prefixes, `**/name`, and trailing-slash directories), which is
enough to answer "does a node_modules survive the rules?" - a
prefix question, not a full pattern-matching one.

Usage::

    python3 scripts/verify_docker_context.py
    python3 scripts/verify_docker_context.py --forbid node_modules .venv

Exit codes: 0 clean, 1 a forbidden directory survives, or the context
could not be examined at all (fail closed, #2083).
"""

from __future__ import annotations

import argparse
import fnmatch
import sys
from pathlib import Path

DEFAULT_FORBIDDEN = ("node_modules",)


def load_patterns(dockerignore: Path) -> list[str]:
    patterns: list[str] = []
    for raw in dockerignore.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("!"):
            continue
        patterns.append(line.rstrip("/"))
    return patterns


def is_ignored(relative: str, patterns: list[str]) -> bool:
    """True when ``relative`` (or a parent of it) is excluded."""
    parts = relative.split("/")
    for pattern in patterns:
        if pattern.startswith("**/"):
            tail = pattern[3:]
            if any(fnmatch.fnmatch(part, tail) for part in parts):
                return True
            continue
        if relative == pattern or relative.startswith(pattern + "/"):
            return True
        if fnmatch.fnmatch(relative, pattern):
            return True
    return False


def scan(root: Path, patterns: list[str], forbidden: tuple[str, ...]) -> tuple[int, list[str]]:
    """Walk the context, returning (paths examined, surviving offenders)."""
    examined = 0
    offenders: list[str] = []
    stack = [root]
    while stack:
        directory = stack.pop()
        try:
            entries = list(directory.iterdir())
        except OSError:
            continue
        for entry in entries:
            relative = entry.relative_to(root).as_posix()
            examined += 1
            if is_ignored(relative, patterns):
                continue
            if entry.is_dir() and not entry.is_symlink():
                if entry.name in forbidden:
                    offenders.append(relative)
                    continue
                stack.append(entry)
    return examined, offenders


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=None)
    parser.add_argument("--forbid", nargs="*", default=list(DEFAULT_FORBIDDEN))
    args = parser.parse_args()

    root = (
        Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent
    )
    dockerignore = root / ".dockerignore"
    if not dockerignore.is_file():
        print(f"missing {dockerignore} - the context cannot be checked", file=sys.stderr)
        return 1

    patterns = load_patterns(dockerignore)
    if not patterns:
        print(f"{dockerignore} carries no patterns - refusing to call that clean", file=sys.stderr)
        return 1

    examined, offenders = scan(root, patterns, tuple(args.forbid))
    print(f"docker context: {examined} paths examined against {len(patterns)} ignore patterns")
    print(f"  forbidden directory names: {', '.join(args.forbid)}")
    if examined == 0:
        print("examined nothing - a scan that walked no paths is not a clean one", file=sys.stderr)
        return 1
    if offenders:
        print("", file=sys.stderr)
        for path in offenders:
            print(f"in the build context but must not be: {path}", file=sys.stderr)
        print(
            "\nA dependency directory in the context can carry absolute symlinks "
            "whose targets lie OUTSIDE it - they resolve on your machine and "
            "dangle in the container (#2112). Exclude it in .dockerignore.",
            file=sys.stderr,
        )
        return 1
    print("  clean - no forbidden directory survives the ignore rules")
    return 0


if __name__ == "__main__":
    sys.exit(main())
