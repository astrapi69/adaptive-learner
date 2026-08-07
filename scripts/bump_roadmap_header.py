#!/usr/bin/env python3
"""bump_roadmap_header.py - mechanical refresh of the dated-prose
version headers in ``docs/ROADMAP.md`` and ``docs/backlog.md`` (#2505).

Both files open with an accumulating dated-prose entry chain
("Current state: **vX.Y.Z (released ...)** Recent prior: **...**" in
the ROADMAP, "State: **post vX.Y.Z (...); prior post ..." in the
backlog). These entries are deliberately NOT in
``scripts/version_display_sites.py``: an existing entry must never be
rewritten in place (it is a dated historical record). What IS
mechanical is PREPENDING the newly released version - which this
script does, seeding the summary from the release's changelog file
and demoting the previous entry to the prior chain.

Run it as release-workflow Step 11 (post-release documentation), then
refine the seeded summary by hand:

    make roadmap-header-bump          # write
    make roadmap-header-bump-dry      # preview only

Idempotent: when both headers already name the canonical version the
script exits 0 without writing. Fails loud (exit 1) when the release
changelog is missing or a header anchor cannot be found - per the
gate contract, "I could not check" must never look like success.

stdlib only (argparse + pathlib + re + tomllib + datetime).
"""

from __future__ import annotations

import argparse
import re
import sys
import tomllib
from datetime import UTC, datetime
from pathlib import Path

ROADMAP_ANCHOR = re.compile(r"Current state: \*\*v(\d+\.\d+\.\d+) \(released ")
BACKLOG_ANCHOR = re.compile(r"State: \*\*post v(\d+\.\d+\.\d+) \(")


def read_canonical_version(repo_root: Path) -> str:
    """Return the canonical app version from backend/pyproject.toml."""
    with (repo_root / "backend" / "pyproject.toml").open("rb") as handle:
        pyproject = tomllib.load(handle)
    return pyproject["tool"]["poetry"]["version"]


def extract_seed_summary(changelog_path: Path) -> str:
    """Return the first prose paragraph of a release-notes file.

    Skips headings and blank lines, collects the first contiguous
    prose block, collapses it to one line, and strips markdown bold
    markers (the header wraps each entry in ``**...**`` itself).
    """
    paragraph_lines: list[str] = []
    for line in changelog_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            if paragraph_lines:
                break
            continue
        if stripped.startswith("#"):
            if paragraph_lines:
                break
            continue
        paragraph_lines.append(stripped)
    return " ".join(paragraph_lines).replace("**", "")


def bump_roadmap(text: str, version: str, date: str, summary: str) -> str | None:
    """Prepend the new Current-state entry; None when already current."""
    match = ROADMAP_ANCHOR.search(text)
    if match is None:
        raise ValueError("ROADMAP.md: 'Current state: **vX.Y.Z (released' anchor not found")
    if match.group(1) == version:
        return None
    new_entry = (
        f"Current state: **v{version} (released {date} - {summary} "
        f"see changelog/releases/v{version}.md).** "
        f"Recent prior: **v{match.group(1)} (released "
    )
    return text.replace(match.group(0), new_entry, 1)


def bump_backlog(text: str, version: str, summary: str) -> str | None:
    """Prepend the new State entry; None when already current."""
    match = BACKLOG_ANCHOR.search(text)
    if match is None:
        raise ValueError("backlog.md: 'State: **post vX.Y.Z (' anchor not found")
    if match.group(1) == version:
        return None
    new_entry = (
        f"State: **post v{version} ({summary} "
        f"see changelog/releases/v{version}.md); "
        f"prior post v{match.group(1)} ("
    )
    return text.replace(match.group(0), new_entry, 1)


def main(argv: list[str] | None = None) -> int:
    """CLI entry point; returns the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root",
        type=Path,
        default=Path.cwd(),
        help="repository root (default: cwd; make runs from the root)",
    )
    parser.add_argument(
        "--date",
        default=datetime.now(UTC).strftime("%Y-%m-%d"),
        help="release date for the new entry (default: today, UTC)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="show what would change without writing",
    )
    args = parser.parse_args(argv)
    repo_root = args.repo_root

    version = read_canonical_version(repo_root)
    changelog_path = repo_root / "changelog" / "releases" / f"v{version}.md"
    if not changelog_path.exists():
        print(f"ERROR: {changelog_path} not found - draft the release notes first")
        return 1
    summary = extract_seed_summary(changelog_path)
    if summary and not summary.endswith((".", ";", ":")):
        summary += "."

    targets = [
        (repo_root / "docs" / "ROADMAP.md", lambda t: bump_roadmap(t, version, args.date, summary)),
        (repo_root / "docs" / "backlog.md", lambda t: bump_backlog(t, version, summary)),
    ]
    for path, transform in targets:
        try:
            updated = transform(path.read_text(encoding="utf-8"))
        except ValueError as error:
            print(f"ERROR: {error}")
            return 1
        if updated is None:
            print(f"  {path.name}: already at v{version}, nothing to do")
            continue
        if args.dry_run:
            print(f"  {path.name}: would prepend v{version} entry (dry run)")
            continue
        path.write_text(updated, encoding="utf-8")
        print(f"  {path.name}: prepended v{version} entry - refine the seeded summary by hand")
    return 0


if __name__ == "__main__":
    sys.exit(main())
