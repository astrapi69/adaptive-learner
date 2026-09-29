#!/usr/bin/env python3
"""Aggregate declared rule changes into one readable log (#2087).

The declaration duty (#2079 / #2081) makes a normative change visible in
its own PR. It does not make it visible ACROSS PRs - and PRs here are
created and merged autonomously, so a declaration nobody aggregates is a
line in a commit message nobody reads.

This script extracts every ``RULE-CHANGE DECLARED:`` block from the commit
messages of a range and appends one row per block to
``docs/rule-change-log.md``. It is meant to run on pushes to the
integration branch, so the log is written by the machine, not by whoever
remembers.

What counts as a declaration (#3252 fault 4, #3268): the documented form
only - a line that starts with ``RULE-CHANGE DECLARED:``, optionally after
a list bullet. The block runs to the next blank line and is logged in full;
a marker quoted inside a sentence is prose, not a declaration.

How a row is keyed (#3252, owner decision): by PR number plus the
declaration text, never by commit sha. A commit cannot contain a row with
its own sha, and sha abbreviations grow with the repository, so a sha key
made the push-time check unsatisfiable and reported every old row as
missing. The PR is derived from, in order: a trailing ``(#N)`` in the
declaring commit's subject; the ``Merge pull request #N`` commit that
brought it onto the first-parent chain; ``--pr N`` (a pull_request run,
where neither exists yet); else the row is ``legacy`` and its sha is its
key.

Usage::

    python3 scripts/append_rule_change_log.py --range <base>..<head>
    python3 scripts/append_rule_change_log.py --range <base>..<head> --check
    python3 scripts/append_rule_change_log.py --range <base>..<head> --pr 4242 --check

``--check`` reports what WOULD be appended, plus duplicate rows, and exits
1 when the log is out of date; without it the file is rewritten.

Exit codes: 0 ok / nothing to add, 1 out of date (with --check) or the
inputs could not be read (fail closed, #2083).
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

MARKER_RE = re.compile(r"^\s*(?:[-*]\s+)?RULE-CHANGE DECLARED:\s*(.*)$")
SUBJECT_PR_RE = re.compile(r"\(#(\d+)\)\s*$")
MERGE_PR_RE = re.compile(r"^Merge pull request #(\d+)\b")
LEGACY = "legacy"
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

Rows are keyed by PR number and declaration text (#3252); a `legacy` row
predates the PR-only channel to develop and is keyed by its commit.

| Date | Commit | PR | Declared change |
|---|---|---|---|
"""
ROW_RE = re.compile(
    r"^\| (?P<date>\d{4}-\d{2}-\d{2}) \| `?(?P<sha>[0-9a-f]{7,40})`? \| (?P<pr>[^|]*?) \| (?P<text>.*) \|$",
    re.MULTILINE,
)


@dataclass(frozen=True)
class Declaration:
    date: str
    sha: str
    pr: str
    text: str

    @property
    def key(self) -> tuple[str, str]:
        """``(pr, text)`` for a PR-keyed row, ``(legacy, sha)`` otherwise."""
        if self.pr == LEGACY:
            return (LEGACY, self.sha)
        return (self.pr, self.text)


def git(root: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"git {' '.join(args)} failed: {result.stderr.strip()}", file=sys.stderr)
        raise SystemExit(1)
    return result.stdout


def is_ancestor(root: Path, ancestor: str, descendant: str) -> bool:
    result = subprocess.run(
        ["git", "merge-base", "--is-ancestor", ancestor, descendant],
        cwd=root,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def blocks(message: str) -> list[str]:
    """Every documented-form declaration in a commit message, flattened."""
    found: list[str] = []
    lines = message.split("\n")
    index = 0
    while index < len(lines):
        match = MARKER_RE.match(lines[index])
        if match is None:
            index += 1
            continue
        parts = [match.group(1)]
        index += 1
        while index < len(lines) and lines[index].strip():
            parts.append(lines[index])
            index += 1
        text = " ".join(" ".join(parts).split())
        if text:
            found.append(text)
    return found


class PrResolver:
    """Which PR brought a commit onto ``head``'s first-parent chain."""

    def __init__(self, root: Path, head: str) -> None:
        self.root = root
        raw = git(root, "rev-list", "--first-parent", "--format=%H%x1f%s", head)
        chain: list[tuple[str, str]] = []
        for line in raw.splitlines():
            if line.startswith("commit "):
                continue
            sha, _, subject = line.partition("\x1f")
            chain.append((sha, subject))
        # Oldest first, so a binary search finds the FIRST chain commit
        # that contains a branch commit: the merge that brought it in.
        self.chain = list(reversed(chain))
        self.on_chain = {sha: subject for sha, subject in self.chain}

    def resolve(self, sha: str, subject: str) -> str | None:
        match = SUBJECT_PR_RE.search(subject)
        if match:
            return f"#{match.group(1)}"
        if sha in self.on_chain:
            return None
        low, high = 0, len(self.chain) - 1
        while low < high:
            mid = (low + high) // 2
            if is_ancestor(self.root, sha, self.chain[mid][0]):
                high = mid
            else:
                low = mid + 1
        merge = MERGE_PR_RE.match(self.chain[low][1]) if self.chain else None
        return f"#{merge.group(1)}" if merge else None


def range_head(rev_range: str) -> str:
    return rev_range.split("..", 1)[1] if ".." in rev_range else rev_range


def declarations(root: Path, rev_range: str, pr_override: str | None) -> list[Declaration]:
    """One entry per declaration block, oldest commit first."""
    raw = git(root, "log", rev_range, "--format=%x00%H%x1f%ad%x1f%s%x1f%B", "--date=short")
    resolver = PrResolver(root, range_head(rev_range))
    found: list[Declaration] = []
    for chunk in raw.split("\x00"):
        if not chunk.strip():
            continue
        parts = chunk.split("\x1f", 3)
        if len(parts) < 4:
            continue
        sha, date, subject, message = parts
        texts = blocks(message)
        if not texts:
            continue
        pr = resolver.resolve(sha, subject) or pr_override or LEGACY
        found.extend(Declaration(date, sha, pr, text) for text in texts)
    return list(reversed(found))


def existing_rows(log_text: str) -> list[Declaration]:
    rows: list[Declaration] = []
    for match in ROW_RE.finditer(log_text):
        pr = match.group("pr").strip()
        rows.append(
            Declaration(
                match.group("date"),
                match.group("sha"),
                LEGACY if pr in ("-", "", LEGACY) else pr,
                match.group("text").strip(),
            )
        )
    return rows


def is_logged(entry: Declaration, rows: list[Declaration]) -> bool:
    if entry.pr == LEGACY:
        # Rows carry an abbreviation whose length grew over time (#3252
        # fault 2): match by prefix, never by exact string.
        return any(row.pr == LEGACY and entry.sha.startswith(row.sha) for row in rows)
    return any(row.key == entry.key for row in rows)


def duplicate_keys(rows: list[Declaration]) -> list[tuple[str, str]]:
    seen: set[tuple[str, str]] = set()
    dupes: list[tuple[str, str]] = []
    for row in rows:
        if row.key in seen and row.key not in dupes:
            dupes.append(row.key)
        seen.add(row.key)
    return dupes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--range", required=True, help="commit range, e.g. <base>..<head>")
    parser.add_argument("--repo-root", default=None)
    parser.add_argument("--check", action="store_true", help="report drift instead of writing")
    parser.add_argument(
        "--pr",
        default=None,
        help="PR number for declaring commits whose PR git cannot name yet (a pull_request run)",
    )
    args = parser.parse_args()

    root = (
        Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent
    )
    log = root / LOG_PATH
    pr_override = f"#{str(args.pr).lstrip('#')}" if args.pr else None

    entries = declarations(root, args.range, pr_override)
    existing = log.read_text(encoding="utf-8") if log.is_file() else ""
    rows = existing_rows(existing)
    dupes = duplicate_keys(rows)

    new = [entry for entry in entries if not is_logged(entry, rows)]
    print(f"{len(entries)} declaration(s) in {args.range}, {len(rows)} row(s) in {LOG_PATH}")
    if not new and not dupes:
        print("rule change log up to date")
        return 0

    if args.check:
        for entry in new:
            print(
                f"MISSING: {entry.date} {entry.sha[:9]} {entry.pr} {entry.text[:80]}",
                file=sys.stderr,
            )
        for pr, text in dupes:
            print(f"DUPLICATE: {pr} {text[:80]}", file=sys.stderr)
        if new:
            print(f"\n{len(new)} declared rule change(s) not in {LOG_PATH}", file=sys.stderr)
        if dupes:
            print(f"{len(dupes)} duplicate row key(s) in {LOG_PATH}", file=sys.stderr)
        return 1

    if dupes:
        for pr, text in dupes:
            print(f"DUPLICATE: {pr} {text[:80]}", file=sys.stderr)
        print(
            f"{len(dupes)} duplicate row key(s) in {LOG_PATH} - fix them by hand first",
            file=sys.stderr,
        )
        return 1

    body = existing if existing else HEADER
    appended = "".join(
        f"| {entry.date} | `{entry.sha[:9]}` | {entry.pr} | {entry.text} |\n" for entry in new
    )
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(body + appended, encoding="utf-8")
    print(f"appended {len(new)} declared rule change(s) to {LOG_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
