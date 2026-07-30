#!/usr/bin/env python3
"""Ratchet the size of the always-injected rule corpus (#2091).

Every ``.claude/rules/**/*.md`` file and ``CLAUDE.md`` is injected into
EVERY prompt of every session - the frontmatter does not gate it
(observed 2026-07-28, see #2089). The corpus is therefore a permanent
context cost, paid on every turn.

Every individual addition to it is justifiable. That is exactly why it
needs a ceiling: nothing was measuring the sum. This gate does, after the
established ratchet pattern (``.complexity-baseline``,
``.inventory-baseline.json``) - the corpus may shrink, and the ceiling
then follows it down; it may not grow without a deliberate, visible act.

Why characters and not tokens: characters are exact, deterministic and
tokenizer-independent. An estimated-token reading would move on its own
whenever the tokenizer changes, and a gate whose number drifts without a
content change teaches people to ignore it. For a human sense of scale,
divide by roughly four.

Usage::

    python3 scripts/verify_rule_corpus_size.py
    python3 scripts/verify_rule_corpus_size.py --update-baseline
    python3 scripts/verify_rule_corpus_size.py --update-baseline --allow-raise

Exit codes: 0 within the ceiling, 1 over it - or the corpus could not be
measured at all (fail closed, #2083).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BASELINE_PATH = Path(".claude/rules/.corpus-baseline.json")
RULES_DIR = Path(".claude/rules")
ANCHOR = Path("CLAUDE.md")


def measure(root: Path) -> tuple[list[tuple[str, int]], list[str]]:
    """Return (path, chars) for the injected set, plus fatal problems.

    The problems list is what keeps this fail-closed: a discovery that
    turns up nothing must never be read as "nothing over the ceiling".
    """
    problems: list[str] = []
    files: list[tuple[str, int]] = []

    anchor = root / ANCHOR
    if anchor.is_file():
        files.append((ANCHOR.as_posix(), len(anchor.read_text(encoding="utf-8"))))
    else:
        problems.append(f"measured nothing: {ANCHOR} is missing - the corpus cannot be measured")

    rules = root / RULES_DIR
    if not rules.is_dir():
        problems.append(f"measured nothing: {RULES_DIR} is missing - the corpus cannot be measured")
        return files, problems

    for path in sorted(rules.rglob("*.md")):
        files.append((path.relative_to(root).as_posix(), len(path.read_text(encoding="utf-8"))))

    if len(files) <= 1:
        problems.append(
            f"measured nothing: no rule files found under {RULES_DIR} - "
            "a ratchet that finds no files is broken, not green"
        )
    return files, problems


def load_baseline(path: Path) -> tuple[dict, str | None]:
    if not path.is_file():
        return {}, f"missing baseline {path} - cannot ratchet against nothing"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return {}, f"unreadable baseline {path}: {exc}"
    if "total_chars" not in data:
        return {}, f"baseline {path} has no total_chars"
    return data, None


def write_baseline(path: Path, files: list[tuple[str, int]], total: int) -> None:
    payload = {
        "note": (
            "Ceiling for the always-injected rule corpus (#2091). Characters, "
            "not tokens - see scripts/verify_rule_corpus_size.py. Lower it with "
            "--update-baseline; raising it needs --allow-raise and belongs in a "
            "commit where the raise is the point."
        ),
        "file_count": len(files),
        "total_chars": total,
        "measured": [name for name, _ in files],
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=None)
    parser.add_argument("--baseline", default=None)
    parser.add_argument("--update-baseline", action="store_true", help="write the measured state")
    parser.add_argument("--allow-raise", action="store_true", help="permit a HIGHER ceiling")
    args = parser.parse_args()

    root = (
        Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent
    )
    baseline_path = Path(args.baseline) if args.baseline else root / BASELINE_PATH

    files, problems = measure(root)
    if problems:
        for problem in problems:
            print(problem, file=sys.stderr)
        return 1

    total = sum(size for _, size in files)
    biggest = sorted(files, key=lambda item: -item[1])[:3]
    # The proof of what was measured: without it, "0 <= ceiling" reads as a
    # pass (the #2079 pathspec class, the #2083 missing-analyzer class).
    print(f"rule corpus: {len(files)} files, {total} chars (~{total // 4} tokens per prompt)")
    print("  largest: " + ", ".join(f"{name} ({size})" for name, size in biggest))
    print(f"  anchored on {ANCHOR} + {RULES_DIR}/**/*.md")

    baseline, error = load_baseline(baseline_path)
    if error and not args.update_baseline:
        print(error, file=sys.stderr)
        return 1

    ceiling = baseline.get("total_chars")

    if args.update_baseline:
        if ceiling is not None and total > ceiling and not args.allow_raise:
            print(
                f"refusing to raise the ceiling {ceiling} -> {total} without --allow-raise.\n"
                "A ratchet only tightens on its own. Growth is allowed, but as a "
                "deliberate act: pass --allow-raise so the raise is the point of "
                "the commit and shows up in the baseline diff.",
                file=sys.stderr,
            )
            return 1
        write_baseline(baseline_path, files, total)
        direction = "lowered" if ceiling is not None and total < ceiling else "set"
        print(f"baseline {direction}: {ceiling} -> {total}")
        return 0

    if total > ceiling:
        over = total - ceiling
        sys.stdout.flush()
        print(
            f"\nrule corpus is {over} chars over the ceiling ({total} > {ceiling}).\n"
            "Every addition here is paid on every prompt of every session. Options:\n"
            "  - condense or delete elsewhere in the corpus (see the condensation rule\n"
            "    in quality-checks.md - deletions are declared, not silent), or\n"
            "  - raise the ceiling deliberately:\n"
            "      make verify-rule-corpus-size-raise\n"
            "    and say in the commit what the corpus bought for the space.",
            file=sys.stderr,
        )
        return 1

    headroom = ceiling - total
    print(f"  within the ceiling ({ceiling}, headroom {headroom})")
    if headroom > 0:
        # #2140: a ratchet that never follows an improvement down is a
        # blanket - the space a deletion won can be spent again later, for
        # free, with nothing saying so. Reported, not applied: tightening
        # silently would make the next legitimate rule addition pay for
        # someone else's deletion.
        print(
            f"  ratchet opportunity: {headroom} chars below the ceiling - lower it with\n"
            "    python3 scripts/verify_rule_corpus_size.py --update-baseline"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
