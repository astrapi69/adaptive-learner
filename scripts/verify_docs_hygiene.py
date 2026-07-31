#!/usr/bin/env python3
"""Docs hygiene gates (#2208). Stdlib only.

Two checks over the documentation tree:

1. Umlaut ratchet - counts ASCII substitute-spellings across the docs prose
   (``docs/**/*.md``). The denylist is EVIDENCE-BASED: each stem is a form
   that actually leaked in a real incident (2026-07-30), never a bare digraph
   scan, so legitimate digraph words (Quelle, neue, aktuell) can never fire.
   The count is ratcheted against a frozen baseline: it may not rise; when it
   falls, lower the baseline (``--update-baseline``) so the gain is locked in.

2. Exploration-index orphan - every ``docs/explorations/EXP-*.md`` must have a
   row in ``EXP-INDEX.md``. File -> row direction ONLY; the hand-maintained
   "Anzahl" count is deliberately NOT checked (a gate on a maintained number
   creates more upkeep than safety).

Fails CLOSED: a missing/unreadable baseline, or a run over zero files, is an
error, never a green pass. Deterministic: exact case-insensitive substring
counts, stable across runs and platforms.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Evidence-based denylist (#2208). Each stem actually leaked on
# 2026-07-30 (EXP-INDEX "Uebersichtstabelle"; the session report's "fuer",
# "waehrend", "eroeffnet", "gepruefte", "aenderungen", "zustaendigkeit").
# None occurs inside any legitimate German or English word, so a plain
# case-insensitive substring match has practically no false positives.
# GROW this list from new EVIDENCE only; never widen it into a digraph scan.
SUBSTITUTE_STEMS = (
    "fuer",
    "waehrend",
    "uebersicht",
    "aenderung",
    "eroeffnet",
    "geprueft",
    "zustaendig",
)

EXP_FILE_RE = re.compile(r"EXP-0*(\d+)")
EXP_ROW_RE = re.compile(r"^\|\s*(\d{3})\s*\|")


def _count_substitutes(docs_dir: Path) -> tuple[int, int, list[str]]:
    """Return (total_occurrences, files_scanned, findings)."""
    total = 0
    files = 0
    findings: list[str] = []
    for md in sorted(docs_dir.rglob("*.md")):
        files += 1
        text = md.read_text(encoding="utf-8", errors="replace").lower()
        for stem in SUBSTITUTE_STEMS:
            n = text.count(stem)
            if n:
                total += n
                findings.append(f"{md}: {stem} x{n}")
    return total, files, findings


def _write_umlaut_baseline(baseline_path: Path, total: int, files: int) -> None:
    baseline_path.write_text(
        json.dumps(
            {
                "umlaut_count": total,
                "umlaut_files_scanned": files,
                "rationale": (
                    "Frozen ASCII substitute-spelling count across docs/**/*.md. "
                    "Stems are evidence-based (real 2026-07-30 leaks), not a "
                    "completeness list. This is an ERROR-COUNTER ratchet, not a "
                    "budget: substitutes should be zero, so any rise is a "
                    "regression and every fall is banked automatically (the "
                    "--auto-lower path, run by the docs-hygiene pre-commit hook) "
                    "so the gain cannot be spent again. Pre-existing substitutions "
                    "(e.g. the DE testplan) are grandfathered; full normalization "
                    "is a separate task."
                ),
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def check_umlaut_ratchet(
    docs_dir: Path, baseline_path: Path, *, update: bool, auto_lower: bool = False
) -> int:
    total, files, findings = _count_substitutes(docs_dir)
    # Fail closed: a run over zero files is not a green result.
    if files == 0:
        print(f"FAIL umlaut-ratchet: scanned 0 files under {docs_dir} (fail-closed)")
        return 1
    if update:
        _write_umlaut_baseline(baseline_path, total, files)
        print(f"umlaut-ratchet baseline set: {total} occurrences over {files} files")
        return 0
    # Fail closed: missing/unreadable baseline is an error, not a pass.
    try:
        ceiling = int(json.loads(baseline_path.read_text(encoding="utf-8"))["umlaut_count"])
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"FAIL umlaut-ratchet: baseline unreadable at {baseline_path} ({exc}) (fail-closed)")
        return 1
    print(
        f"umlaut-ratchet: scanned {files} files, {total} substitute occurrence(s) "
        f"(baseline {ceiling})"
    )
    if total > ceiling:
        # A rise is a regression, never auto-anything - even under --auto-lower.
        # Growth in an error-counter is only ever a deliberate, justified raise
        # (make verify-docs-hygiene-raise), never automatic.
        print(f"FAIL umlaut-ratchet: count rose {ceiling} -> {total}. New ASCII substitutes:")
        for f in findings:
            print(f"  {f}")
        return 1
    if total < ceiling:
        # A fall is an improvement of an error-counter (substitutes should be
        # zero). Bank it so the headroom can never be spent again (#2230). The
        # docs-hygiene pre-commit hook runs --auto-lower, so the lowered
        # baseline rides the same commit; the read-only check still FAILS on an
        # unbanked fall, which is what catches a stale baseline in CI.
        if auto_lower:
            _write_umlaut_baseline(baseline_path, total, files)
            print(
                f"umlaut-ratchet: auto-lowered baseline {ceiling} -> {total} "
                "(improvement banked - commit the updated baseline)"
            )
            return 0
        print(
            f"FAIL umlaut-ratchet: count fell {ceiling} -> {total} without banking the gain.\n"
            "  The docs-hygiene pre-commit hook banks it automatically; re-commit,\n"
            "  or run: python3 scripts/verify_docs_hygiene.py --auto-lower"
        )
        return 1
    return 0


def check_exploration_index(explorations_dir: Path, index_path: Path) -> int:
    files: dict[int, str] = {}
    for p in sorted(explorations_dir.glob("EXP-*.md")):
        m = EXP_FILE_RE.search(p.name)
        if m:
            files[int(m.group(1))] = p.name
    # Fail closed: nothing found means the scan looked in the wrong place.
    if not files:
        print(f"FAIL exploration-index: found 0 EXP-*.md under {explorations_dir} (fail-closed)")
        return 1
    try:
        rows = {
            int(m.group(1))
            for line in index_path.read_text(encoding="utf-8").splitlines()
            if (m := EXP_ROW_RE.match(line))
        }
    except OSError as exc:
        print(f"FAIL exploration-index: index unreadable at {index_path} ({exc}) (fail-closed)")
        return 1
    print(f"exploration-index: checked {len(files)} EXP file(s) against {len(rows)} index row(s)")
    orphans = sorted(n for n in files if n not in rows)
    if orphans:
        print("FAIL exploration-index: EXP file(s) without an index row:")
        for n in orphans:
            print(f"  {files[n]} (no row {n:03d} in {index_path.name})")
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="repo root that contains docs/ (default: the checkout this script lives in)",
    )
    ap.add_argument("--baseline", type=Path, default=None, help="override the baseline JSON path")
    ap.add_argument("--only", choices=("umlaut", "index", "all"), default="all")
    ap.add_argument("--update-baseline", action="store_true", help="freeze the current count")
    ap.add_argument(
        "--auto-lower",
        action="store_true",
        help=(
            "bank a fall automatically: an improvement below the baseline lowers "
            "it and passes (a rise still fails). Used by the docs-hygiene "
            "pre-commit hook so the gain rides the commit."
        ),
    )
    args = ap.parse_args(argv)

    docs = args.root / "docs"
    baseline = args.baseline or (docs / ".docs-hygiene-baseline.json")

    if args.update_baseline:
        return check_umlaut_ratchet(docs, baseline, update=True)

    rc = 0
    if args.only in ("umlaut", "all"):
        rc |= check_umlaut_ratchet(docs, baseline, update=False, auto_lower=args.auto_lower)
    if args.only in ("index", "all"):
        rc |= check_exploration_index(docs / "explorations", docs / "explorations" / "EXP-INDEX.md")
    return rc


if __name__ == "__main__":
    sys.exit(main())
