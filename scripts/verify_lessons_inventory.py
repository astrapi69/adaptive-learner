#!/usr/bin/env python3
"""Completeness gate for the themed lessons catalogue (#2073).

The lessons catalogue was split from one 128k monolith into
``.claude/rules/lessons/*.md``. A reorganization is exactly the PR shape
that lost content in the quality-checks incident, so completeness is not
argued, it is checked:

* ``--snapshot <ref>`` writes the section inventory of a git revision
  (section title + SHA-256 of the section body) to stdout as JSON.
* ``--compare <baseline.json>`` rebuilds the inventory from the working
  tree and fails when any section is missing, duplicated, or altered.

Stdlib only, no network, safe to run in CI and from pre-commit.

Usage::

    python3 scripts/verify_lessons_inventory.py --snapshot <ref> > base.json
    python3 scripts/verify_lessons_inventory.py --compare base.json

Exit codes: 0 ok, 1 drift, 2 usage error.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
LESSONS_DIR = REPO_ROOT / ".claude" / "rules" / "lessons"
MONOLITH = ".claude/rules/lessons-learned.md"


def _strip_frontmatter(text: str) -> str:
    """Return the body after a leading YAML frontmatter block, if present."""
    if not text.startswith("---\n"):
        return text
    parts = text.split("---\n", 2)
    return parts[2] if len(parts) == 3 else text


def sections(text: str) -> list[tuple[str, str]]:
    """Split markdown into ``(title, body)`` pairs at every ``## `` heading."""
    out: list[tuple[str, str]] = []
    title: str | None = None
    buf: list[str] = []
    for line in _strip_frontmatter(text).split("\n"):
        if line.startswith("## "):
            if title is not None:
                out.append((title, "\n".join(buf)))
            title, buf = line[3:].rstrip(), [line]
        elif title is not None:
            buf.append(line)
    if title is not None:
        out.append((title, "\n".join(buf)))
    return out


def _digest(body: str) -> str:
    return hashlib.sha256(body.strip().encode("utf-8")).hexdigest()[:16]


def inventory_from_ref(ref: str) -> dict[str, str]:
    """Section inventory of the pre-split monolith at ``ref``."""
    blob = subprocess.run(
        ["git", "show", f"{ref}:{MONOLITH}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return {title: _digest(body) for title, body in sections(blob)}


def inventory_from_tree() -> tuple[dict[str, str], dict[str, str]]:
    """Section inventory of the themed files plus a title -> file map."""
    found: dict[str, str] = {}
    owner: dict[str, str] = {}
    duplicates: list[str] = []
    for path in sorted(LESSONS_DIR.glob("*.md")):
        for title, body in sections(path.read_text(encoding="utf-8")):
            if title in found:
                duplicates.append(f"{title} (in {owner[title]} and {path.name})")
            found[title] = _digest(body)
            owner[title] = path.name
    if duplicates:
        print("DUPLICATE sections:", file=sys.stderr)
        for dup in duplicates:
            print(f"  - {dup}", file=sys.stderr)
        sys.exit(1)
    return found, owner


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--snapshot", metavar="REF", help="write the inventory of REF's monolith")
    group.add_argument("--compare", metavar="BASELINE", help="compare the tree against BASELINE")
    args = parser.parse_args()

    if args.snapshot:
        json.dump(inventory_from_ref(args.snapshot), sys.stdout, indent=2, sort_keys=True)
        print()
        return 0

    baseline = json.loads(Path(args.compare).read_text(encoding="utf-8"))
    found, owner = inventory_from_tree()

    missing = sorted(set(baseline) - set(found))
    extra = sorted(set(found) - set(baseline))
    changed = sorted(t for t in set(baseline) & set(found) if baseline[t] != found[t])

    for label, items in (("MISSING", missing), ("UNEXPECTED", extra), ("ALTERED", changed)):
        for title in items:
            where = f" [{owner.get(title, '-')}]" if title in owner else ""
            print(f"{label}: {title}{where}", file=sys.stderr)

    if missing or extra or changed:
        print(
            f"\nlessons inventory DRIFT: {len(missing)} missing, {len(extra)} unexpected, "
            f"{len(changed)} altered (baseline {len(baseline)} sections)",
            file=sys.stderr,
        )
        return 1

    print(f"lessons inventory OK: {len(found)} sections, all bodies byte-identical to the baseline")
    return 0


if __name__ == "__main__":
    sys.exit(main())
