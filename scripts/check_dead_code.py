#!/usr/bin/env python3
"""Dead-code ratchet for Python functions and TS exports (#2741).

The dead-CLASSNAME gates (#1491) cover CSS consumers; unused Python/TS
CODE - the AI-typical stranded helper - had no detection. This wrapper
runs the two detectors the issue names and ratchets their findings:

- Python: ``vulture`` over ``backend/app`` plus every plugin package IN
  ONE INVOCATION, so a cross-package caller counts as usage (the #2486
  consumer-set lesson: a scope that misses a caller surface produces
  false "dead" verdicts). Tests are deliberately NOT consumers - a
  helper kept alive only by its own unit test is exactly the target
  class. Findings are filtered to function/method/class/property: the
  unused-VARIABLE class is dominated by signature params on specs and
  event listeners (hookspecs.py is excluded outright - a pluggy spec
  file is all signatures).
- TypeScript: ``knip`` over ``frontend`` (unused exports + types; knip
  resolves the vite entry graph itself, and its default project scope
  counts test files as consumers - conservative on purpose for v1).

Baseline contract (``.dead-code-baseline.json``): a LIST of findings
(``path::name::kind``), never a count - detectors are noisy oracles, so
only a named entry is comparable across runs. Line numbers are omitted:
they drift on every edit above the finding.

- A finding NOT in the baseline fails the run (new dead code).
- A baseline entry no longer found is REPORTED as resolvable but never
  auto-removed (#2140: the oracle drifts, a human banks the shrink via
  ``--update-baseline`` after verifying).
- Deleting code from a finding is NEVER done in bulk off this list:
  every deletion PR verifies its findings individually against every
  caller surface (pluginforge entry_points, hookspecs, dynamic imports,
  package-emitted usage - the #2477/#2486 incident class).

Fail-closed (#2083 point 3): a missing tool, an unreadable baseline or
an empty scan scope exits non-zero. Point 4: the run prints what it
scanned. A partial run exists only as the EXPLICIT ``--only`` scope,
printed in the output - never by silence.

Usage::

    python3 scripts/check_dead_code.py                  # check both sides
    python3 scripts/check_dead_code.py --only python
    python3 scripts/check_dead_code.py --update-baseline
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

BASELINE_PATH = Path(".dead-code-baseline.json")
PY_KINDS = ("function", "method", "class", "property")
VULTURE_MIN_CONFIDENCE = "60"
VULTURE_EXCLUDE = "hookspecs.py"

_VULTURE_LINE = re.compile(r"^(?P<path>[^:]+):\d+: unused (?P<kind>[a-z]+) '(?P<name>[^']+)'")


def repo_root() -> Path:
    """The repo root from git, never from ``__file__`` (worktree lesson)."""
    out = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        capture_output=True,
        text=True,
        check=True,
    )
    return Path(out.stdout.strip())


def scan_python(root: Path) -> tuple[set[str], int] | None:
    """Vulture findings as ``path::name::kind``, plus the scope size.

    Returns ``None`` when vulture cannot run (fail closed at the caller).
    """
    plugin_pkgs = sorted(
        str(p.relative_to(root))
        for p in root.glob("plugins/adaptive-learner-plugin-*/adaptive_learner_*")
        if p.is_dir()
    )
    scope = ["backend/app", *plugin_pkgs]
    if len(scope) < 2:
        print(
            f"dead-code: python scope collapsed to {scope} - refusing to "
            "call an app-only scan a full one (#2486)",
            file=sys.stderr,
        )
        return None
    cmd = [
        sys.executable,
        "-m",
        "vulture",
        *scope,
        "--min-confidence",
        VULTURE_MIN_CONFIDENCE,
        "--exclude",
        VULTURE_EXCLUDE,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=root)
    if proc.returncode not in (0, 3):  # 3 = vulture found something
        print(
            f"dead-code: vulture failed (exit {proc.returncode}) - a scan "
            f"that cannot run is not a clean scan:\n{proc.stderr.strip()[:500]}",
            file=sys.stderr,
        )
        return None
    findings: set[str] = set()
    for line in proc.stdout.splitlines():
        match = _VULTURE_LINE.match(line.strip())
        if not match:
            continue
        if match.group("kind") not in PY_KINDS:
            continue
        findings.add(f"{match.group('path')}::{match.group('name')}::{match.group('kind')}")
    return findings, len(scope)


def scan_typescript(root: Path) -> tuple[set[str], int] | None:
    """Knip findings as ``path::name::kind``, plus the issue-file count."""
    cmd = [
        "bunx",
        "knip",
        "--include",
        "exports,types",
        "--reporter",
        "json",
        "--no-exit-code",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=root / "frontend")
    if proc.returncode != 0 or not proc.stdout.strip():
        print(
            f"dead-code: knip failed (exit {proc.returncode}) - a scan that "
            f"cannot run is not a clean scan:\n{proc.stderr.strip()[:500]}",
            file=sys.stderr,
        )
        return None
    try:
        report = json.loads(proc.stdout)
    except json.JSONDecodeError as err:
        print(f"dead-code: knip emitted unparseable JSON: {err}", file=sys.stderr)
        return None
    findings: set[str] = set()
    issues = report.get("issues", [])
    for issue in issues:
        path = issue.get("file", "?")
        for export in issue.get("exports", []):
            findings.add(f"frontend/{path}::{export.get('name')}::export")
        for type_export in issue.get("types", []):
            findings.add(f"frontend/{path}::{type_export.get('name')}::type")
    return findings, len(issues)


def load_baseline(path: Path) -> dict[str, list[str]] | None:
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text())
        return {
            "python": list(raw.get("python", [])),
            "typescript": list(raw.get("typescript", [])),
        }
    except (json.JSONDecodeError, AttributeError) as err:
        print(f"dead-code: baseline unreadable ({err}) - failing closed", file=sys.stderr)
        return None


def write_baseline(path: Path, python: set[str], typescript: set[str]) -> None:
    payload = {
        "note": (
            "Tracked dead-code findings (#2741) - the UNVERIFIED tail. An "
            "entry here is a detector claim, not a verdict: deletion "
            "requires individual verification against every caller surface "
            "(#2486). New findings fail scripts/check_dead_code.py; "
            "resolved entries are banked manually via --update-baseline."
        ),
        "python": sorted(python),
        "typescript": sorted(typescript),
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", choices=["python", "typescript"], default=None)
    parser.add_argument("--update-baseline", action="store_true")
    parser.add_argument("--baseline", default=None)
    args = parser.parse_args()

    root = repo_root()
    baseline_path = Path(args.baseline) if args.baseline else root / BASELINE_PATH

    sides: dict[str, set[str]] = {}
    if args.only in (None, "python"):
        result = scan_python(root)
        if result is None:
            return 1
        sides["python"], scope_size = result
        print(
            f"dead-code [python]: {len(sides['python'])} finding(s) across "
            f"{scope_size} package roots (vulture, min-confidence "
            f"{VULTURE_MIN_CONFIDENCE}, kinds {'/'.join(PY_KINDS)})"
        )
    if args.only in (None, "typescript"):
        result = scan_typescript(root)
        if result is None:
            return 1
        sides["typescript"], issue_files = result
        print(
            f"dead-code [typescript]: {len(sides['typescript'])} finding(s) "
            f"in {issue_files} file(s) (knip, exports+types)"
        )
    if args.only:
        print(f"dead-code: PARTIAL run by explicit --only {args.only}")

    if args.update_baseline:
        existing = load_baseline(baseline_path) or {"python": [], "typescript": []}
        merged = {
            "python": sides.get("python", set(existing["python"])),
            "typescript": sides.get("typescript", set(existing["typescript"])),
        }
        write_baseline(baseline_path, merged["python"], merged["typescript"])
        print(f"dead-code: baseline written to {baseline_path}")
        return 0

    baseline = load_baseline(baseline_path)
    if baseline is None:
        print(
            f"dead-code: no readable baseline at {baseline_path} - seed one "
            "deliberately with --update-baseline (#2083: absent basis is "
            "never green)",
            file=sys.stderr,
        )
        return 1

    failed = False
    for side, findings in sides.items():
        known = set(baseline[side])
        new = sorted(findings - known)
        resolved = sorted(known - findings)
        if new:
            failed = True
            print(f"\ndead-code [{side}]: {len(new)} NEW finding(s):")
            for entry in new:
                print(f"  + {entry}")
        if resolved:
            print(
                f"\ndead-code [{side}]: {len(resolved)} baseline entr(ies) no "
                "longer found - verify and bank via --update-baseline:"
            )
            for entry in resolved[:20]:
                print(f"  - {entry}")
    if failed:
        print(
            "\nNew dead code detected. Either it is genuinely unused (delete "
            "it - after verifying every caller surface, #2486) or the "
            "detector missed a consumer (add the entry to the baseline WITH "
            "a reason in the PR).",
            file=sys.stderr,
        )
        return 1
    print("\ndead-code: no new findings against the baseline.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
