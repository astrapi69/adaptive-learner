#!/usr/bin/env python3
r"""testid_reference_gate.py - PR-visible guard for spec-referenced testids (#1661).

Companion to ``.github/workflows/visual-baseline-gate.yml`` (#1641). That
gate makes the "visual-critical change without a baseline update" gap
PR-visible; this one makes ONE slice of the "green PR -> red nightly/push"
category (#1661) PR-visible: a ``data-testid`` that an e2e spec addresses
is REMOVED or RENAMED on a high-user-visibility surface, without any e2e
spec being touched in the same PR.

Why only that slice, and why it stays targeted (the #1661 cost/benefit
criterion): a broad "touched a watched component -> must touch a spec"
presence gate would fire on almost every ordinary component edit, produce
false positives, and get bypassed. This gate instead does a precise
testid-diff and fires ONLY when a *statically referenced* testid literal
actually disappears net from a watched path. That has a near-zero
false-positive rate: renaming/removing a testid a spec depends on is
either a real break or requires the spec to change with it.

HONEST SCOPE BOUNDARY (per the repo's "wired != working" discipline):
this catches the RENAME/REMOVE sub-class only. The #1656 motivating case -
where a panel rework WRAPPED existing testid carriers into a collapsed,
``hidden`` panel (the testid literal survived, only its visibility
changed) - is NOT machine-catchable from a literal diff and stays a
reviewer + nightly (dexie-smoke / manual-automation) concern. See the
lessons-learned entry "PR-CI vs nightly gates" for the full category and
the reviewer rule.

WATCHED SURFACES (high user visibility - #1661 scope criterion):
  frontend/src/components/lesson/**      lesson runner + controls
  frontend/src/pages/lesson/**
  frontend/src/components/exercises/**   exercise renderers
  frontend/src/components/dashboard/**   dashboard
  frontend/src/pages/dashboard/**
  frontend/src/components/content/**      content browser
  frontend/src/pages/content/**
  frontend/src/components/settings/**     settings core
  frontend/src/pages/system/Settings.tsx

Referenced-testid oracle: every static ``getByTestId("x")`` /
``[data-testid="x"]`` / ``data-testid="x"`` literal across ``e2e/**/*.ts``
(the working tree at HEAD). Dynamic ``data-testid={`${x}-y`}`` template
parts are unreadable and deliberately skipped (never guessed) - the same
posture ``check-dead-classnames.py`` takes for dynamic classNames.

Exit codes:
  0 = no spec-referenced testid was net-removed from a watched path, OR
      an e2e spec was also touched in this PR (the fix travelled with it)
  1 = a spec-referenced testid disappeared from a watched path and no
      e2e spec changed -> the next nightly/dexie-smoke run would go red

The escape hatch (a ``testid-refs-unaffected`` label) lives in the
workflow, mirroring the visual-baseline-gate label handling.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

# High-user-visibility surfaces (git pathspecs, repo-root relative).
WATCHED_PATHSPECS: tuple[str, ...] = (
    "frontend/src/components/lesson",
    "frontend/src/pages/lesson",
    "frontend/src/components/exercises",
    "frontend/src/components/dashboard",
    "frontend/src/pages/dashboard",
    "frontend/src/components/content",
    "frontend/src/pages/content",
    "frontend/src/components/settings",
    "frontend/src/pages/system/Settings.tsx",
)

# A static ``data-testid="foo"`` / ``data-testid='foo'`` literal. The
# template-literal form ``data-testid={...}`` has no leading quote after
# ``=`` and is intentionally not matched.
_TESTID_LITERAL_RE = re.compile(r"""data-testid=["']([^"'{}$`]+)["']""")

# How a spec addresses a testid: getByTestId("x"), locator patterns
# [data-testid="x"], and raw data-testid="x". Only static literals.
_TESTID_REF_RE = re.compile(
    r"""(?:getByTestId\(\s*["']([^"'{}$`]+)["']|"""
    r"""\[data-testid=["']([^"'{}$`]+)["']\]|"""
    r"""data-testid=["']([^"'{}$`]+)["'])"""
)


def extract_testid_literals(text: str) -> set[str]:
    """Return the set of static ``data-testid`` literals defined in ``text``."""
    return set(_TESTID_LITERAL_RE.findall(text))


def extract_referenced_testids(text: str) -> set[str]:
    """Return the set of static testids an e2e spec ``text`` addresses."""
    found: set[str] = set()
    for a, b, c in _TESTID_REF_RE.findall(text):
        found.add(a or b or c)
    found.discard("")
    return found


def net_removed_testids(diff_text: str) -> set[str]:
    """Testids present on removed diff lines but not on any added line.

    Parses a unified diff. A ``data-testid`` literal counts as removed only
    if it is net-gone (a move/rename that re-adds the same literal elsewhere
    in the diff is not a removal). File headers (``---`` / ``+++``) are
    skipped.
    """
    removed: set[str] = set()
    added: set[str] = set()
    for line in diff_text.splitlines():
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line.startswith("-"):
            removed |= extract_testid_literals(line)
        elif line.startswith("+"):
            added |= extract_testid_literals(line)
    return removed - added


def evaluate_gate(
    referenced: set[str],
    net_removed_on_watched: set[str],
    spec_changed: bool,
) -> tuple[bool, set[str]]:
    """Decide the gate outcome.

    Returns ``(ok, offending)`` where ``offending`` is the set of
    spec-referenced testids that were net-removed from a watched path.
    ``ok`` is True when there is nothing offending, or when a spec was
    also touched (the fix travelled with the removal).
    """
    offending = net_removed_on_watched & referenced
    if not offending:
        return True, set()
    if spec_changed:
        return True, offending
    return False, offending


# --------------------------------------------------------------------------
# CLI wiring (git seam - kept thin so the logic above is testable offline)
# --------------------------------------------------------------------------


def _git(args: list[str]) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=REPO,
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def _collect_referenced_testids() -> set[str]:
    referenced: set[str] = set()
    for spec in (REPO / "e2e").rglob("*.ts"):
        referenced |= extract_referenced_testids(spec.read_text(encoding="utf-8"))
    return referenced


def _changed_files(base: str, head: str) -> list[str]:
    out = _git(["diff", "--name-only", f"{base}...{head}"])
    return [line for line in out.splitlines() if line]


def _spec_changed(changed: list[str]) -> bool:
    return any(f.startswith("e2e/") and f.endswith(".ts") for f in changed)


def _watched_diff(base: str, head: str) -> str:
    return _git(["diff", f"{base}...{head}", "--", *WATCHED_PATHSPECS])


def run(base: str, head: str) -> int:
    referenced = _collect_referenced_testids()
    net_removed = net_removed_testids(_watched_diff(base, head))
    spec_changed = _spec_changed(_changed_files(base, head))
    ok, offending = evaluate_gate(referenced, net_removed, spec_changed)

    if not offending:
        print(
            "::notice::testid-reference-gate: no spec-referenced testid was "
            "removed/renamed on a watched surface - gate not applicable."
        )
        return 0
    listing = ", ".join(sorted(offending))
    if ok:
        print(
            "::notice::testid-reference-gate: spec-referenced testids "
            f"changed on a watched surface ({listing}), and an e2e spec was "
            "also touched in this PR - OK. Reviewers: confirm the spec update "
            "matches the new testid."
        )
        return 0
    print(
        "::error::testid-reference-gate: these spec-referenced testids were "
        f"removed/renamed on a high-visibility surface but NO e2e spec "
        f"changed in this PR: {listing}."
    )
    print(
        "::error::The next nightly / dexie-smoke / manual-automation run "
        "would go red (#1661). Update the e2e spec(s) that address these "
        "testids in THIS PR, or - if the removal is verifiably spec-inert - "
        "add the 'testid-refs-unaffected' label."
    )
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base",
        default="origin/develop",
        help="Base ref (merge-base side of the three-dot diff).",
    )
    parser.add_argument("--head", default="HEAD", help="Head ref to compare.")
    args = parser.parse_args(argv)
    return run(args.base, args.head)


if __name__ == "__main__":
    sys.exit(main())
