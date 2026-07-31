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

Fails CLOSED: a missing/unreadable baseline, a run over zero files, or an
unreadable git index is an error, never a green pass. Deterministic: exact
case-insensitive substring counts, stable across runs and platforms; scan
targets come from the git index (``git ls-files``), never from the raw
filesystem, so gitignored local artifacts cannot move the number (#2217).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
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


def _tracked_markdown(root: Path, subdir: str) -> list[Path]:
    """Enumerate ``*.md`` under ``subdir`` via the git index (#2217).

    Gitignored and never-staged files are invisible to CI and absent from the
    commit being built, so they must be invisible to this gate too - the
    number has to mean the same thing on every machine (gate contract point
    5). Staged new files ARE in the index, so the pre-commit path still sees
    them. Entries deleted from the working tree are skipped (they cannot
    contribute prose). Raises RuntimeError when the index cannot be read -
    the caller fails closed.
    """
    proc = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--cached", "--", subdir],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"git ls-files failed under {root}: {proc.stderr.strip() or 'no git index'}"
        )
    paths = [root / rel for rel in proc.stdout.split("\0") if rel.endswith(".md")]
    return [p for p in paths if p.exists()]


def _count_substitutes(root: Path) -> tuple[int, int, list[str]]:
    """Return (total_occurrences, files_scanned, findings) over tracked docs."""
    total = 0
    files = 0
    findings: list[str] = []
    for md in sorted(_tracked_markdown(root, "docs")):
        files += 1
        text = md.read_text(encoding="utf-8", errors="replace").lower()
        for stem in SUBSTITUTE_STEMS:
            n = text.count(stem)
            if n:
                total += n
                findings.append(f"{md}: {stem} x{n}")
    return total, files, findings


def check_umlaut_ratchet(root: Path, baseline_path: Path, update: bool) -> int:
    try:
        total, files, findings = _count_substitutes(root)
    except RuntimeError as exc:
        print(f"FAIL umlaut-ratchet: {exc} (fail-closed)")
        return 1
    # Fail closed: a run over zero files is not a green result.
    if files == 0:
        print(f"FAIL umlaut-ratchet: scanned 0 tracked files under {root}/docs (fail-closed)")
        return 1
    if update:
        baseline_path.write_text(
            json.dumps(
                {
                    "umlaut_count": total,
                    "umlaut_files_scanned": files,
                    "rationale": (
                        "Frozen ASCII substitute-spelling count across the git-tracked "
                        "docs/**/*.md (index enumeration, #2217 - gitignored local "
                        "artifacts must not move the number). "
                        "Stems are evidence-based (real 2026-07-30 leaks), not a "
                        "completeness list. Ratchet: the count may not rise; lower it "
                        "here whenever it falls so the gain cannot be spent again. "
                        "Pre-existing substitutions (e.g. the DE testplan) are "
                        "grandfathered; full normalization is a separate task."
                    ),
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"umlaut-ratchet baseline set: {total} occurrences over {files} files")
        return 0
    # Fail closed: missing/unreadable baseline is an error, not a pass.
    try:
        ceiling = int(json.loads(baseline_path.read_text(encoding="utf-8"))["umlaut_count"])
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"FAIL umlaut-ratchet: baseline unreadable at {baseline_path} ({exc}) (fail-closed)")
        return 1
    print(
        f"umlaut-ratchet: scanned {files} tracked files (git index), "
        f"{total} substitute occurrence(s) (baseline {ceiling})"
    )
    if total > ceiling:
        print(f"FAIL umlaut-ratchet: count rose {ceiling} -> {total}. New ASCII substitutes:")
        for f in findings:
            print(f"  {f}")
        return 1
    if total < ceiling:
        print(
            f"FAIL umlaut-ratchet: count fell {ceiling} -> {total} (a gain). Lock it in:\n"
            f"  python3 scripts/verify_docs_hygiene.py --update-baseline"
        )
        return 1
    return 0


def check_exploration_index(root: Path, index_path: Path) -> int:
    try:
        tracked = _tracked_markdown(root, "docs/explorations")
    except RuntimeError as exc:
        print(f"FAIL exploration-index: {exc} (fail-closed)")
        return 1
    files: dict[int, str] = {}
    for p in sorted(tracked):
        if not p.name.startswith("EXP-"):
            continue
        m = EXP_FILE_RE.search(p.name)
        if m:
            files[int(m.group(1))] = p.name
    # Fail closed: nothing found means the scan looked in the wrong place.
    if not files:
        print(
            f"FAIL exploration-index: found 0 tracked EXP-*.md under "
            f"{root}/docs/explorations (fail-closed)"
        )
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
    args = ap.parse_args(argv)

    docs = args.root / "docs"
    baseline = args.baseline or (docs / ".docs-hygiene-baseline.json")

    if args.update_baseline:
        return check_umlaut_ratchet(args.root, baseline, update=True)

    rc = 0
    if args.only in ("umlaut", "all"):
        rc |= check_umlaut_ratchet(args.root, baseline, update=False)
    if args.only in ("index", "all"):
        rc |= check_exploration_index(args.root, docs / "explorations" / "EXP-INDEX.md")
    return rc


if __name__ == "__main__":
    sys.exit(main())
