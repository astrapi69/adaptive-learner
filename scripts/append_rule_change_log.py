#!/usr/bin/env python3
"""Aggregate declared rule changes into one readable log (#2087).

The declaration duty (#2079 / #2081) makes a normative change visible in
its own PR. It does not make it visible ACROSS PRs - and PRs here are
created and merged autonomously, so a declaration nobody aggregates is a
line in a commit message nobody reads.

This script extracts ``RULE-CHANGE DECLARED:`` blocks from a commit range
and appends one row per declaration to ``docs/rule-change-log.md``. It is
meant to run on pushes to the integration branch, so the log is written
by the machine, not by whoever remembers.

Usage::

    python3 scripts/append_rule_change_log.py --range <base>..<head>
    python3 scripts/append_rule_change_log.py --range <base>..<head> --check

``--check`` reports what WOULD be appended and exits 1 when the log is
out of date; without it the file is rewritten.

Exit codes: 0 ok / nothing to add, 1 out of date (with --check) or the
inputs could not be read (fail closed, #2083).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

MARKER = "RULE-CHANGE DECLARED"
LOG_PATH = Path("docs/rule-change-log.md")
HEADER = """# Rule change log

Every declared change to binding rule wording or to gate coupling lands here,
appended by `scripts/append_rule_change_log.py` from the merged commits - not
by hand, so it cannot be forgotten.

Read this file to see, in a few minutes, what moved in the rules. The
declaration duty itself lives in
[`quality-checks.md`](../.claude/rules/quality-checks.md) ("Normative changes
are declared, not buried" and "Condensation PRs are content-neutral or
declared").

| Date | Commit | PR | Declared change |
|---|---|---|---|
"""
# Rows carry the sha in backticks; matching without them made the check
# report every entry as missing forever (found by its own first run).
ROW_RE = re.compile(r"^\| \d{4}-\d{2}-\d{2} \| `?([0-9a-f]{7,})`? \|", re.MULTILINE)


def git(root: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"git {' '.join(args)} failed: {result.stderr.strip()}", file=sys.stderr)
        raise SystemExit(1)
    return result.stdout


def declarations(root: Path, rev_range: str) -> list[tuple[str, str, str, str]]:
    """(date, short sha, pr, one-line declaration) per declaring commit."""
    raw = git(root, "log", rev_range, "--format=%x00%h%x1f%ad%x1f%s%x1f%b", "--date=short")
    found: list[tuple[str, str, str, str]] = []
    for chunk in raw.split("\x00"):
        if not chunk.strip():
            continue
        parts = chunk.split("\x1f")
        if len(parts) < 4:
            continue
        sha, date, subject, body = parts[0], parts[1], parts[2], parts[3]
        if MARKER not in body and MARKER not in subject:
            continue
        text = f"{subject}\n{body}"
        idx = text.index(MARKER)
        # The declaration is the sentence after the marker, flattened.
        tail = text[idx + len(MARKER) :].lstrip(": ").split("\n\n")[0]
        one_line = " ".join(tail.split())
        pr = ""
        match = re.search(r"\(#(\d+)\)", subject)
        if match:
            pr = f"#{match.group(1)}"
        found.append((date, sha, pr, one_line[:300]))
    return list(reversed(found))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--range", required=True, help="commit range, e.g. <base>..<head>")
    parser.add_argument("--repo-root", default=None)
    parser.add_argument("--check", action="store_true", help="report drift instead of writing")
    args = parser.parse_args()

    root = (
        Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent
    )
    log = root / LOG_PATH

    entries = declarations(root, args.range)
    existing = log.read_text(encoding="utf-8") if log.is_file() else ""
    known = set(ROW_RE.findall(existing))

    new = [e for e in entries if e[1] not in known]
    if not new:
        print(f"rule change log up to date ({len(known)} entries)")
        return 0

    if args.check:
        for date, sha, pr, text in new:
            print(f"MISSING: {date} {sha} {pr} {text[:80]}", file=sys.stderr)
        print(f"\n{len(new)} declared rule change(s) not in {LOG_PATH}", file=sys.stderr)
        return 1

    body = existing if existing else HEADER
    rows = "".join(f"| {date} | `{sha}` | {pr or '-'} | {text} |\n" for date, sha, pr, text in new)
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(body + rows, encoding="utf-8")
    print(f"appended {len(new)} declared rule change(s) to {LOG_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
