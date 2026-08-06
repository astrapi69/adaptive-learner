#!/usr/bin/env python3
"""Docs hygiene gates (#2208, #2311). Depends on manuscript-tools (pinned).

Two checks over the documentation tree:

1. Umlaut ratchet - counts German ASCII substitute-spellings (``fuer`` for
   ``für``, ``waehrend`` for ``während``, ...) across the git-tracked docs
   prose (``docs/**/*.md`` EXCEPT ``docs/journal/**``, see below). The
   detection is delegated to manuscript-tools' ``ascii-umlauts`` rule (#2311):
   a WHOLE-WORD (``\\b(...)\\b``) match against a curated 465-word list, with
   code fences, inline code, link targets and URLs excluded. That is what
   fixes #2289 at the root - the German substitute stems used to be matched as
   SUBSTRINGS, so Spanish ``fuera`` / Portuguese ``esfuerzo`` tripped the gate
   on correct foreign prose; a whole-word list cannot, because ``fuera`` is
   not on the list. So the scan no longer has to be scoped to German prose:
   every non-German help locale is scanned too and contributes zero false
   positives (measured), and the only exclusion left is the journal.

   The wordlist is a FOREIGN-TOOL ORACLE, not our own error counter, so this
   ratchet does NOT auto-lower (contrast #2230): a fall could be a genuine
   reduction OR the oracle's list shrinking under a version bump, and the two
   are indistinguishable from the count alone (gate contract point 5,
   quality-checks.md - a gate on a drifting oracle never auto-lowers). The
   pinned version is printed on every run so the number is anchored to a known
   list; a genuine reduction is banked DELIBERATELY via
   ``make verify-docs-hygiene-raise`` (``--update-baseline``), never
   automatically. ``docs/journal/**`` is excluded because journals are dated
   records of what was; rewriting them retroactively makes reconstructions
   from them, so the count does not fall to zero and that is honest.

2. Exploration-index orphan - every ``docs/explorations/EXP-*.md`` must have a
   row in ``EXP-INDEX.md``. File -> row direction ONLY; the hand-maintained
   "Anzahl" count is deliberately NOT checked (a gate on a maintained number
   creates more upkeep than safety).

Fails CLOSED: a missing/unreadable baseline, a run over zero files, an
unreadable git index, or an unimportable manuscript-tools is an error, never a
green pass. Deterministic for a pinned manuscript-tools version: scan targets
come from the git index (``git ls-files``), never the raw filesystem, so
gitignored local artifacts cannot move the number (#2217).
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

try:
    import manuscript_tools
    from manuscript_tools.checker import UMLAUT_WORDS, check_file, make_rule_ascii_umlauts

    _MT_IMPORT_ERROR: Exception | None = None
    _UMLAUT_RULE = make_rule_ascii_umlauts()
except ImportError as exc:  # pragma: no cover - exercised via the fail-closed path
    manuscript_tools = None  # type: ignore[assignment]
    UMLAUT_WORDS = frozenset()  # type: ignore[assignment]
    check_file = None  # type: ignore[assignment]
    _MT_IMPORT_ERROR = exc
    _UMLAUT_RULE = None

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


def _is_journal(md: Path, root: Path) -> bool:
    """True for ``docs/journal/**`` pages, which are excluded (#2311).

    Journals are dated records of what was said and done; a retroactive umlaut
    rewrite would turn a reconstruction source into a reconstruction. They stay
    out of the ratchet, and the frozen number is honest about that.
    """
    parts = md.relative_to(root).parts
    return len(parts) >= 2 and parts[0] == "docs" and parts[1] == "journal"


def _is_review(md: Path, root: Path) -> bool:
    """True for ``docs/review/**`` pages, which are excluded (#2311).

    Review exports are frozen VERBATIM WITNESSES (i18n catalog wordings at a
    pinned commit): every line quotes a catalog value in order to make a
    statement about its spelling. Counting them turns witnesses into
    violations; rewriting them makes the document claim a catalog state that
    never existed - the same class as the journal exclusion.
    """
    parts = md.relative_to(root).parts
    return len(parts) >= 2 and parts[0] == "docs" and parts[1] == "review"


def _violation_word_count(message: str) -> int:
    """Number of flagged words in one ``ascii-umlauts`` violation message.

    manuscript-tools reports one violation per LINE but names each substitute
    word: ``ASCII-Umlaut gefunden: "Loesung" (gemeint: "Lösung"), "fuer"
    (gemeint: "für")``. Counting the ``(gemeint:`` markers yields the word-level
    count, so a second substitute added to an already-flagged line still raises
    the ratchet. The exact-pinned manuscript-tools version keeps this message
    format stable.
    """
    return message.count("(gemeint:")


def _count_substitutes(root: Path) -> tuple[int, int, list[str]]:
    """Return (total_substitute_words, files_scanned, findings) over docs prose.

    Uses manuscript-tools' whole-word ``ascii-umlauts`` rule (#2311), which
    excludes code fences / inline code / URLs, so foreign-language substrings
    (Spanish ``fuera``) never match. ``docs/journal/**`` is excluded; every
    other docs surface - including the non-German help locales - is scanned.
    ``files`` counts only the scanned (in-scope) files, so the reported set
    matches what was measured.
    """
    total = 0
    files = 0
    findings: list[str] = []
    for md in sorted(_tracked_markdown(root, "docs")):
        if _is_journal(md, root) or _is_review(md, root):
            continue
        files += 1
        report = check_file(md, [_UMLAUT_RULE])
        for violation in report.violations:
            total += _violation_word_count(violation.message)
            findings.append(f"{md}:{violation.line}: {violation.message}")
    return total, files, findings


def _write_umlaut_baseline(baseline_path: Path, total: int, files: int) -> None:
    version = getattr(manuscript_tools, "__version__", "unknown")
    baseline_path.write_text(
        json.dumps(
            {
                "umlaut_count": total,
                "umlaut_files_scanned": files,
                "rationale": (
                    "Frozen German ASCII substitute-spelling count across the "
                    "git-tracked docs/**/*.md prose, EXCLUDING docs/journal/** "
                    "(#2311: journals are dated records; rewriting them makes "
                    "reconstructions from them) and docs/review/** (#2311 "
                    "blocker finding: frozen verbatim witnesses of i18n catalog "
                    "wordings - counting them turns witnesses into violations). "
                    "The number does not fall to zero and that is honest: the "
                    "remainder is C-stock the curated list does not know, "
                    "generated artefacts (fix belongs in the generator) and "
                    "all-caps grep keys. Detection is manuscript-tools' "
                    f"whole-word ascii-umlauts rule, pinned at {version} "
                    "(condition: pin exactly, not >=). Whole-word matching fixes "
                    "#2289 at the root - Spanish fuera / Portuguese esfuerzo can "
                    "no longer trip the gate because they are not on the list - "
                    "so the non-German help locales are IN scope and measured to "
                    "contribute zero false positives, and the old German-prose "
                    "scoping is gone. Index enumeration (#2217 - gitignored local "
                    "artifacts must not move the number). This is a FOREIGN-TOOL "
                    "ORACLE ratchet, not our own error counter: it does NOT "
                    "auto-lower (a fall can be a genuine reduction OR the list "
                    "shrinking under a version bump, indistinguishable from the "
                    "count alone), so a genuine reduction is banked deliberately "
                    "via make verify-docs-hygiene-raise. A rise is a regression. "
                    "Count is word-level (per flagged word, not per line)."
                ),
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )


def check_umlaut_ratchet(root: Path, baseline_path: Path, *, update: bool) -> int:
    if _MT_IMPORT_ERROR is not None:
        print(
            "FAIL umlaut-ratchet: manuscript-tools is not importable "
            f"({_MT_IMPORT_ERROR}); pin manuscript-tools and install it "
            "(fail-closed)"
        )
        return 1
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
        _write_umlaut_baseline(baseline_path, total, files)
        print(f"umlaut-ratchet baseline set: {total} occurrences over {files} files")
        return 0
    # Fail closed: missing/unreadable baseline is an error, not a pass.
    try:
        ceiling = int(json.loads(baseline_path.read_text(encoding="utf-8"))["umlaut_count"])
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"FAIL umlaut-ratchet: baseline unreadable at {baseline_path} ({exc}) (fail-closed)")
        return 1
    version = getattr(manuscript_tools, "__version__", "unknown")
    print(
        f"umlaut-ratchet [manuscript-tools {version}, {len(UMLAUT_WORDS)} words]: "
        f"scanned {files} tracked files (git index), "
        f"{total} substitute occurrence(s) (baseline {ceiling})"
    )
    if total > ceiling:
        # A rise is a regression, never automatic. Growth is only ever a
        # deliberate, justified raise (make verify-docs-hygiene-raise).
        print(f"FAIL umlaut-ratchet: count rose {ceiling} -> {total}. New ASCII substitutes:")
        for f in findings:
            print(f"  {f}")
        return 1
    if total < ceiling:
        # A fall is NOT auto-banked: the wordlist is a foreign-tool oracle, so
        # a fall may be a genuine reduction OR the list shrinking under a
        # version bump. Bank it deliberately after confirming the cause.
        print(
            f"FAIL umlaut-ratchet: count fell {ceiling} -> {total}. This is a "
            "foreign-tool oracle, so the fall is not banked automatically - "
            "confirm it is a real reduction (not a manuscript-tools version "
            "change), then bank it: make verify-docs-hygiene-raise"
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
    ap.add_argument(
        "--update-baseline",
        action="store_true",
        help="freeze the current count (deliberate raise/lower via make verify-docs-hygiene-raise)",
    )
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
