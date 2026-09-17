"""Help-changelog currency gate for scripts/verify_docs.py (#3161).

The per-locale "What's new" page ``docs/help/<locale>/changelog.md`` is
version-based by definition, so the prose-version gate exempts it (#1767).
Nothing else looked at it, and the page stopped at v1.91 while the app
shipped 29 more releases. This check FAILs when a locale's newest
``## vX.Y.Z`` heading is older than the canonical ``major.minor``; a
missing patch release is not drift. Range headings such as
``## v2.12.0–v2.15.0`` count with their highest version.

A locale page without any version heading, or a help tree without any
changelog page, is a FAIL: a missing basis never reads as clean (#2287).
"""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import Protocol

CHECK = "help-changelog"
HEADING_RE = re.compile(r"^#{2,3}\s+(.*)$")
VERSION_RE = re.compile(r"v(\d+)\.(\d+)\.(\d+)")


class _Report(Protocol):
    def fail(self, check: str, message: str, fixed: bool = False) -> None: ...

    def note(self, message: str) -> None: ...


def newest_heading_version(text: str) -> tuple[int, int, int] | None:
    """Return the highest vX.Y.Z found in any level-2/3 heading, or None."""
    versions = [
        tuple(int(part) for part in match.groups())
        for line in text.splitlines()
        if (heading := HEADING_RE.match(line))
        for match in VERSION_RE.finditer(heading.group(1))
    ]
    return max(versions) if versions else None


def check_help_changelog(
    report: _Report,
    help_dir: Path,
    canonical: str,
    read: Callable[[Path], str] = lambda p: p.read_text(encoding="utf-8"),
) -> None:
    """FAIL when a locale's changelog page lags the canonical minor version."""
    pages = sorted(help_dir.glob("*/changelog.md"))
    if not pages:
        report.fail(
            CHECK,
            f"no */changelog.md pages under {help_dir} - cannot verify (basis missing; #2287)",
        )
        return
    wanted = tuple(int(part) for part in canonical.split(".")[:2])
    report.note(f"{CHECK}: scanned {len(pages)} changelog pages against v{wanted[0]}.{wanted[1]}")
    for page in pages:
        rel = f"{page.parent.name}/changelog.md"
        newest = newest_heading_version(read(page))
        if newest is None:
            report.fail(
                CHECK, f"{rel}: no version heading found - cannot tell which release it covers"
            )
            continue
        if newest[:2] < wanted:
            report.fail(
                CHECK,
                f"{rel}: newest entry is v{newest[0]}.{newest[1]}.{newest[2]}, the app is "
                f"v{wanted[0]}.{wanted[1]} - add the missing releases (release-workflow.md Step 3)",
            )
