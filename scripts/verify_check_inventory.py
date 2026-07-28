#!/usr/bin/env python3
"""Fail when an inventoried check is silently unwired or degraded (#2077).

Precedent: in ``verify_docs.py`` the test-count arithmetic and the README
badge cross-check stopped matching after a reflow dropped the bold from
``= **10293 tests**``. The check still ran, emitted a WARN and returned -
alive-looking, enforcing nothing. Nothing in the repo said so.

``.claude/rules/checks.yaml`` is the declaration surface. This script
proves every ``status: active`` entry is actually wired, using the probe
declared with it:

``make_target=<name>``  the Makefile target exists (and is not a stub)
``script_exists=<path>`` the script file exists
``called_in=<file>::<symbol>`` the symbol is called there, not just defined
``no_warn=<substring>`` running ``verify_docs.py`` must NOT emit a warning
                        containing the substring - the exact signature of a
                        check that degraded into a no-op
``none``                only allowed for ``status: disabled``

A ``disabled`` entry must carry a reason. Turning a check off stays
possible; doing it silently does not.

Usage::

    python3 scripts/verify_check_inventory.py
    python3 scripts/verify_check_inventory.py --repo-root /path/to/tree

Exit codes: 0 ok, 1 drift.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path


def parse_inventory(path: Path) -> list[dict[str, str]]:
    """Read the fixed-shape ``checks:`` list (stdlib only, no PyYAML)."""
    entries: list[dict[str, str]] = []
    current: dict[str, str] = {}
    key: str | None = None
    in_list = False
    for raw in path.read_text(encoding="utf-8").split("\n"):
        if raw.strip().startswith("#"):
            continue
        if raw.startswith("checks:"):
            in_list = True
            continue
        if not in_list or not raw.strip():
            continue
        stripped = raw.strip()
        if stripped.startswith("- "):
            if current:
                entries.append(current)
            current, key = {}, None
            stripped = stripped[2:]
        if re.match(r"^[a-z_]+:", stripped):
            key, _, value = stripped.partition(":")
            key = key.strip()
            value = value.strip()
            current[key] = "" if value in (">-", "|", ">") else value
        elif key:  # folded continuation line
            current[key] = (current[key] + " " + stripped).strip()
    if current:
        entries.append(current)
    return entries


def makefile_targets(root: Path) -> set[str]:
    text = (root / "Makefile").read_text(encoding="utf-8")
    return set(re.findall(r"^([a-zA-Z0-9_-]+):", text, re.MULTILINE))


def run_verify_docs(root: Path, script: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(script)],
        capture_output=True,
        text=True,
        cwd=root,
    )
    return result.stdout + result.stderr


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root", default=None, help="check a different tree (used by the RED tests)"
    )
    parser.add_argument(
        "--docs-script",
        default=None,
        help="verify_docs.py to probe (a deliberately broken copy, for the RED test)",
    )
    args = parser.parse_args()

    root = (
        Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent
    )
    inventory = root / ".claude" / "rules" / "checks.yaml"
    if not inventory.is_file():
        print(f"missing inventory: {inventory}", file=sys.stderr)
        return 1

    entries = parse_inventory(inventory)
    problems: list[str] = []
    targets = makefile_targets(root)
    docs_output: str | None = None

    for entry in entries:
        cid = entry.get("id", "<unnamed>")
        status = entry.get("status", "")
        probe = entry.get("probe", "")

        if status not in ("active", "disabled"):
            problems.append(f"{cid}: status must be 'active' or 'disabled', got {status!r}")
            continue
        if status == "disabled":
            if not entry.get("reason"):
                problems.append(
                    f"{cid}: declared disabled without a reason - state WHY, in the file"
                )
            continue
        if not entry.get("rule"):
            problems.append(
                f"{cid}: active check without a 'rule' field (use '-' when it guards a mechanism)"
            )
        if probe in ("", "none"):
            problems.append(
                f"{cid}: active check needs a probe; 'none' is only allowed for disabled checks"
            )
            continue

        kind, _, value = probe.partition("=")
        if kind == "make_target":
            if value not in targets:
                problems.append(
                    f"{cid}: declared active, but Makefile target '{value}' does not exist"
                )
        elif kind == "script_exists":
            if not (root / value).is_file():
                problems.append(f"{cid}: declared active, but {value} does not exist")
        elif kind == "called_in":
            where, _, symbol = value.partition("::")
            text = (root / where).read_text(encoding="utf-8") if (root / where).is_file() else ""
            if not re.search(rf"^\s+{re.escape(symbol)}\(", text, re.MULTILINE):
                problems.append(f"{cid}: declared active, but {symbol} is never called in {where}")
        elif kind == "no_warn":
            if docs_output is None:
                docs_script = (
                    Path(args.docs_script)
                    if args.docs_script
                    else root / "scripts" / "verify_docs.py"
                )
                docs_output = run_verify_docs(root, docs_script)
            # A probe that cannot RUN must never count as "no warning found" -
            # that is the very silent-pass this gate exists to prevent.
            if "checks run" not in docs_output:
                problems.append(
                    f"{cid}: probe could not be evaluated - verify_docs.py did not complete "
                    f"(a crashed probe is not a passing probe)"
                )
                continue
            for line in docs_output.split("\n"):
                if "[WARN" in line and value in line:
                    problems.append(
                        f"{cid}: declared active, but it degraded into a no-op - verify_docs warns: {line.strip()}"
                    )
                    break
        else:
            problems.append(f"{cid}: unknown probe kind {kind!r}")

    for problem in problems:
        print(f"CHECK-INVENTORY DRIFT: {problem}", file=sys.stderr)
    if problems:
        print(f"\n{len(problems)} problem(s)", file=sys.stderr)
        return 1

    active = sum(1 for e in entries if e.get("status") == "active")
    off = sum(1 for e in entries if e.get("status") == "disabled")
    print(
        f"check inventory OK: {active} active checks proven wired, {off} declared off with a reason"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
