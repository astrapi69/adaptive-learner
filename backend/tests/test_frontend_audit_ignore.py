"""The frontend audit exemptions live in one file, each with its reason (#3549).

``bun audit --audit-level=high`` blocks CI (``ci.yml``, Frontend Tests) and
the local pre-PR gate (``make check-security``). An advisory that has no
patched release and only reaches a dev-only chain is exempted by its ID, the
convention the pip-audit step documents ("document the ID, never drop the
gate"). Both blocking callers read the same list, so the two can never
disagree, and every listed ID carries a comment saying why and when it goes.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
IGNORE_FILE = ROOT / "frontend" / "audit-ignore.txt"
CI = ROOT / ".github" / "workflows" / "ci.yml"
MAKEFILE = ROOT / "Makefile"
ADVISORY_ID = re.compile(r"^(GHSA(-[23456789cfghjmpqrvwx]{4}){3}|CVE-\d{4}-\d{4,})$")


def _entries() -> list[tuple[str, list[str]]]:
    """Return (advisory id, comment lines directly above it) per listed ID."""
    if not IGNORE_FILE.is_file():
        pytest.fail(f"{IGNORE_FILE} is missing - the exemptions have no single home")
    entries: list[tuple[str, list[str]]] = []
    comments: list[str] = []
    for line in IGNORE_FILE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped:
            comments = []
        elif stripped.startswith("#"):
            comments.append(stripped.lstrip("#").strip())
        else:
            entries.append((stripped, comments))
            comments = []
    return entries


def test_every_exemption_is_an_advisory_id_with_a_reason() -> None:
    entries = _entries()
    assert entries, "an empty exemption list must not be read as a checked one"
    for advisory, reason in entries:
        assert ADVISORY_ID.match(advisory), f"not an advisory id: {advisory!r}"
        assert any(advisory in line for line in reason), (
            f"{advisory}: the comment directly above must name the ID and say why"
        )


def test_the_known_braces_advisory_is_exempted() -> None:
    assert "GHSA-vfj7-8cjw-p6xm" in [advisory for advisory, _ in _entries()]


@pytest.mark.parametrize(
    ("caller", "anchor"),
    [
        (CI, "bun audit --audit-level=high"),
        (MAKEFILE, "bun audit --audit-level=high"),
    ],
    ids=["ci-frontend-tests", "make-check-security"],
)
def test_both_blocking_audits_read_the_one_list(caller: Path, anchor: str) -> None:
    lines = [
        line
        for line in caller.read_text(encoding="utf-8").splitlines()
        if anchor in line and "echo" not in line
    ]
    assert lines, f"{caller.name} no longer runs the blocking audit"
    assert all("audit-ignore.txt" in line or "$ignores" in line for line in lines), (
        f"{caller.name}: a blocking audit that does not read audit-ignore.txt"
    )
    assert "audit-ignore.txt" in caller.read_text(encoding="utf-8")
