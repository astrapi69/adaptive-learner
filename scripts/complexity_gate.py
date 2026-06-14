#!/usr/bin/env python3
"""Ratchet gate for cyclomatic complexity (#407, Phase 2 of #400).

Reads a radon JSON report (Python, filtered to a minimum rank) and an eslint
JSON report (TypeScript, with the ``complexity`` rule injected), reduces them to
the worst complexity per FILE, and compares that to a frozen
``.complexity-baseline``. Mirrors the cohesion watcher's ``.filesize-baseline``
ratchet (#372) at the same file-level granularity: an existing offender file is
tolerated at or below its frozen worst-complexity, but the gate FAILS when

  * a file with an over-threshold function is not in the baseline (new debt), or
  * a baselined file's worst complexity exceeds its frozen value (regression).

File-level identity is deterministic and stable (no function names, line numbers,
or anonymous-function indexing to drift). ``--update-baseline`` rewrites the
baseline from the current offenders so it can only shrink as files are
refactored.

Baseline line format: ``<repo-relative-file> <worst-cyclomatic-complexity>``.
Python rank D/E/F means cc > 20 (cc >= 21); the TypeScript threshold is
eslint's ``complexity`` option (> 20). The Phase 2 hard gate tightened the
Python detection from rank E/F (cc >= 31) to rank D (cc > 20) so both
languages share one cc > 20 threshold.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

# radon ranks: A 1-5, B 6-10, C 11-20, D 21-30, E 31-40, F 41+.
# Phase 2 hard gate: rank D and worse (cc > 20) are gate offenders, matching
# the TypeScript eslint complexity > 20 threshold.
PY_WARN_RANKS = {"D", "E", "F"}
_CC_RE = re.compile(r"complexity of (\d+)")


def _rel_from_marker(path: str, marker: str) -> str:
    """Return ``path`` truncated to start at ``marker`` (e.g. 'frontend/')."""
    idx = path.find(marker)
    return path[idx:] if idx != -1 else path


def _worst_per_file(pairs: list[tuple[str, int]]) -> dict[str, int]:
    worst: dict[str, int] = {}
    for path, cc in pairs:
        worst[path] = max(worst.get(path, 0), cc)
    return worst


def collect_python(radon_json_path: str) -> list[tuple[str, int]]:
    """(file, cc) for every Python block ranked E or F."""
    with open(radon_json_path, encoding="utf-8") as handle:
        raw = handle.read().strip()
    report = json.loads(raw) if raw else {}
    out: list[tuple[str, int]] = []
    for path, blocks in report.items():
        if not isinstance(blocks, list):
            continue
        for block in blocks:
            if block.get("rank") in PY_WARN_RANKS:
                out.append((path, int(block.get("complexity", 0))))
    return out


def collect_typescript(eslint_json_path: str) -> list[tuple[str, int]]:
    """(file, cc) for every eslint ``complexity`` finding."""
    with open(eslint_json_path, encoding="utf-8") as handle:
        raw = handle.read().strip()
    results = json.loads(raw) if raw else []
    out: list[tuple[str, int]] = []
    for file_result in results:
        rel = _rel_from_marker(str(file_result.get("filePath", "")), "frontend/")
        for message in file_result.get("messages", []):
            if message.get("ruleId") != "complexity":
                continue
            cc_match = _CC_RE.search(str(message.get("message", "")))
            out.append((rel, int(cc_match.group(1)) if cc_match else 0))
    return out


def load_baseline(path: str) -> dict[str, int]:
    baseline: dict[str, int] = {}
    if not os.path.exists(path):
        return baseline
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.split("#", 1)[0].strip()
            if not line:
                continue
            parts = line.rsplit(None, 1)
            if len(parts) == 2 and parts[1].isdigit():
                baseline[parts[0]] = int(parts[1])
    return baseline


def write_baseline(path: str, worst: dict[str, int]) -> None:
    header = [
        "# .complexity-baseline - ratchet for existing complexity offenders (#407)",
        "#",
        "# Worst cyclomatic complexity per file at the moment the hard gate landed.",
        "# Format: <repo-relative-file> <worst-cyclomatic-complexity>",
        "# A file is tolerated at or below its frozen value; the gate FAILS on a",
        "# new over-threshold file or a regression above the frozen value. This",
        "# file may only SHRINK - refactor a file's worst function below the value",
        "# (or below threshold), then run `make check-complexity-gate-update`.",
        "#",
        "# Thresholds (Phase 2 hard gate): Python radon rank D/E/F (cc > 20);",
        "# TypeScript eslint complexity > 20. New over-threshold functions block",
        "# immediately; existing offenders below are grandfathered (ratchet may",
        "# only shrink). File-level granularity matches .filesize-baseline.",
        "",
    ]
    body = [f"{path_} {worst[path_]}" for path_ in sorted(worst)]
    with open(path, "w", encoding="utf-8") as handle:
        handle.write("\n".join(header + body) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--radon-json", required=True)
    parser.add_argument("--eslint-json", required=True)
    parser.add_argument("--baseline", default=".complexity-baseline")
    parser.add_argument("--update-baseline", action="store_true")
    args = parser.parse_args()

    current = _worst_per_file(
        collect_python(args.radon_json) + collect_typescript(args.eslint_json)
    )

    if args.update_baseline:
        write_baseline(args.baseline, current)
        print(f"Wrote {args.baseline} with {len(current)} offender file(s).")
        return 0

    baseline = load_baseline(args.baseline)
    in_actions = bool(os.environ.get("GITHUB_ACTIONS"))

    violations: list[str] = []
    for path in sorted(current):
        cc = current[path]
        frozen = baseline.get(path)
        if frozen is None:
            violations.append(f"NEW      {path} (worst cc {cc}, not in baseline)")
            if in_actions:
                print(f"::error file={path}::New over-threshold file (worst cc {cc})")
        elif cc > frozen:
            violations.append(f"REGRESS  {path} (worst cc {cc} > baseline {frozen})")
            if in_actions:
                print(
                    f"::error file={path}::Complexity regressed to {cc} "
                    f"(baseline {frozen})"
                )

    tolerated = sum(1 for p in current if p in baseline and current[p] <= baseline[p])
    improvable = sorted(p for p in baseline if p not in current)

    print("\n=== Complexity ratchet gate ===")
    print(f"Baseline files   : {len(baseline)}")
    print(f"Current offenders: {len(current)}  (tolerated: {tolerated})")
    if improvable:
        print(
            f"Ratchet opportunity: {len(improvable)} baselined file(s) no longer "
            "over threshold - run `make check-complexity-gate-update` to shrink:"
        )
        for path in improvable:
            print(f"  - {path}")
    if violations:
        print(f"\nFAIL: {len(violations)} complexity violation(s):")
        for violation in violations:
            print(f"  {violation}")
        print(
            "\nReduce the file's worst function complexity, or - if intentional -"
            " update the baseline via `make check-complexity-gate-update`."
        )
        return 1
    print("\nComplexity gate passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
