#!/usr/bin/env python3
"""Emit warn-only complexity findings from ``radon cc --json`` (#400).

Reads radon's JSON cyclomatic-complexity report (already filtered to a
minimum rank, e.g. ``--min E``) from stdin and prints each block ranked
E or F. Under GitHub Actions it also emits ``::warning::`` annotations
(inline PR comments) and appends a Markdown summary to the step summary.

Phase 1 is warn-only: this script never exits non-zero, so a complex
function is visible but never blocks a merge.
"""

from __future__ import annotations

import json
import os
import sys

WARN_RANKS = {"E", "F"}


def _display_name(block: dict) -> str:
    """``Class.method`` for methods, plain name otherwise."""
    name = str(block.get("name", "?"))
    classname = block.get("classname")
    return f"{classname}.{name}" if classname else name


def main() -> int:
    raw = sys.stdin.read().strip()
    try:
        report = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        # Malformed/empty radon output must not break the watcher.
        print("None (no parseable radon output).")
        return 0

    findings: list[tuple[str, int, str, str, int]] = []
    for path, blocks in sorted(report.items()):
        if not isinstance(blocks, list):
            continue
        for block in blocks:
            rank = block.get("rank")
            if rank not in WARN_RANKS:
                continue
            findings.append(
                (
                    path,
                    int(block.get("lineno", 0)),
                    _display_name(block),
                    str(rank),
                    int(block.get("complexity", 0)),
                )
            )

    if not findings:
        print("None.")
    else:
        for path, line, name, rank, cc in findings:
            print(f"{path}:{line} {name} - rank {rank} (cc {cc})")

    if os.environ.get("GITHUB_ACTIONS"):
        for path, line, name, rank, cc in findings:
            print(
                f"::warning file={path},line={line}::"
                f"Cyclomatic complexity rank {rank} (cc {cc}) in {name}"
            )

    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write("### Complexity watcher - Python (radon, warn-only)\n\n")
            if not findings:
                handle.write("No functions ranked E or F.\n\n")
            else:
                handle.write(
                    f"{len(findings)} function(s) ranked E or F "
                    "(consider refactoring):\n\n"
                )
                for path, line, name, rank, cc in findings:
                    handle.write(f"- `{path}:{line}` {name} - **{rank}** (cc {cc})\n")
                handle.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
