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
simply is not present that day. Neither does a walk of the checkout
(#3253): a CI checkout carries no node_modules, so a walk passed there
whatever `.dockerignore` said. So this checks the RULES: it synthesizes
nested dependency directories under every root `backend/Dockerfile`
copies into the image (the COPY lines are the single source of what is
an image input) and asks the ignore rules whether each one survives.
The checkout is still walked afterwards as a second, environment-bound
signal, and both counts are reported - a scan that probed nothing must
not look like a clean one (gate contract point 4, quality-checks.md).

Stdlib only: it implements the `.dockerignore` subset this repo uses
(plain prefixes, `**/name`, and trailing-slash directories), which is
enough to answer "does a node_modules survive the rules?" - a
prefix question, not a full pattern-matching one.

Usage::

    python3 scripts/verify_docker_context.py
    python3 scripts/verify_docker_context.py --forbid node_modules .venv

Exit codes: 0 clean, 1 a forbidden directory survives the rules (on a
synthesized path or on disk), or the rules could not be examined at all
(no .dockerignore, no patterns, no Dockerfile, no COPY line - fail
closed, #2083).
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


def copy_roots(dockerfile: Path) -> list[str]:
    """The top-level context directories the Dockerfile copies into the image.

    Reads every ``COPY`` instruction that takes its sources from the build
    context (``--from=`` stages are image-internal) and keeps the first
    path component of each source, in order of first appearance.
    """
    roots: list[str] = []
    for raw in dockerfile.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line.upper().startswith("COPY ") or "--from=" in line:
            continue
        operands = [op for op in line.split()[1:] if not op.startswith("--")]
        for source in operands[:-1]:
            head = source.lstrip("./").split("/")[0]
            if head and head not in roots:
                roots.append(head)
    return roots


def probe_paths(roots: list[str], forbidden: tuple[str, ...]) -> list[str]:
    """Synthesized context paths a forbidden directory could occupy.

    One at the context root, one deep under an arbitrary tree, and per
    COPY root one directly inside it, one nested (the #2112 shape: a linked
    content repo under ``frontend/public/content``) and one several levels
    down. Every one of them must be excluded by the rules.
    """
    probes: list[str] = []
    for name in forbidden:
        probes.append(name)
        probes.append(f"some/unrelated/tree/{name}")
        for root in roots:
            probes.append(f"{root}/{name}")
            probes.append(f"{root}/public/content/linked-repo/{name}")
            probes.append(f"{root}/a/b/c/{name}")
    return probes


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
    parser.add_argument(
        "--dockerfile",
        default="backend/Dockerfile",
        help="the Dockerfile whose COPY lines name the image inputs (relative to the repo root)",
    )
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

    dockerfile = root / args.dockerfile
    if not dockerfile.is_file():
        print(f"missing {dockerfile} - the image inputs cannot be derived", file=sys.stderr)
        return 1
    roots = copy_roots(dockerfile)
    if not roots:
        print(
            f"{dockerfile} has no COPY line from the context - refusing to probe nothing",
            file=sys.stderr,
        )
        return 1

    forbidden = tuple(args.forbid)
    probes = probe_paths(roots, forbidden)
    if not probes:
        print("no forbidden directory name given - refusing to probe nothing", file=sys.stderr)
        return 1
    surviving = [probe for probe in probes if not is_ignored(probe, patterns)]
    print(
        f"docker context rules: {len(probes)} synthesized paths probed against "
        f"{len(patterns)} ignore patterns (COPY roots: {', '.join(roots)})"
    )
    examined, offenders = scan(root, patterns, forbidden)
    print(f"docker context: {examined} paths examined against {len(patterns)} ignore patterns")
    print(f"  forbidden directory names: {', '.join(forbidden)}")
    if examined == 0:
        print("examined nothing - a scan that walked no paths is not a clean one", file=sys.stderr)
        return 1
    if surviving or offenders:
        print("", file=sys.stderr)
        for path in surviving:
            print(f"the rules would let this into the build context: {path}", file=sys.stderr)
        for path in offenders:
            print(f"in the build context but must not be: {path}", file=sys.stderr)
        print(
            "\nA dependency directory in the context can carry absolute symlinks "
            "whose targets lie OUTSIDE it - they resolve on your machine and "
            "dangle in the container (#2112). Exclude it in .dockerignore.",
            file=sys.stderr,
        )
        return 1
    print("  clean - no forbidden directory survives the ignore rules, probed or on disk")
    return 0


if __name__ == "__main__":
    sys.exit(main())
