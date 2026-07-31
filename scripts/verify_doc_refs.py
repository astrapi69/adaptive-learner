#!/usr/bin/env python3
"""Nameable doc references must exist (#2254). Stdlib only.

Docs and rule files may only NAME things the repository contains. Three
same-day precedents (2026-07-31): a constant that never existed in code
(``LICENSING_ENABLED``, #2096), seven make targets presented as real by a
condensed rule file (state ``76a6b994``, #2081 family), and a dead path
asserted as existing by a lessons file (#1903 family). All three are
machine-checkable because the references are nameable.

WHAT IS JUDGED - exactly three classes, nothing else:

1. **Make targets**: inline backticks of the form ``make <target>`` (an
   optional trailing ``VAR=...`` assignment is allowed), plus target
   DEFINITION lines inside ```` ```makefile ```` / ```` ```make ````
   fences - a makefile fence presents targets as existing (precedent 2).
   Checked against the root Makefile's target list.
2. **Repository paths**: inline backticks whose FIRST segment is a real
   top-level entry of this repository (``backend/…``, ``frontend/…``,
   ``docs/…``, ``.claude/…``, …). That anchor is what separates a
   repo-relative path from the three look-alikes that are NOT judged:
   editor-relative fragments (``storage/index.ts`` under
   ``frontend/src/``), foreign owner/repo slugs
   (``astrapi69/adaptive-learner-content``) and package names
   (``@types/node``). Placeholder segments (``vX.Y.Z``, ``YYYY-MM-DD``,
   ``{name}``, ``<lang>``) are templates, not claims, and are skipped.
   Globs are satisfied by at least one match. Checked against
   ``git ls-files`` (files or tracked-directory prefixes).
3. **Constants / environment variables**: inline backticks in
   SCREAMING_SNAKE with at least one underscore. Checked via
   ``git grep`` over the tracked tree EXCLUDING docs/ and .claude/ (a
   doc naming a constant must not prove itself).

Everything else in backticks - command lines, fragments, example values,
non-makefile fences - is deliberately NOT judged. Do not widen these
classes: the boundary is what keeps the check free of prose judgement.

Exemptions are single-line and named: ``<!-- doc-ref-exempt: reason -->``
on the SAME line skips that line (for deliberate counter-examples such as
the documented dead path in lessons/docs-i18n.md). No blanket exclusions.

The baseline (``docs/.doc-refs-baseline.json``) is an ERROR COUNTER, not
a budget (#2235 three-way distinction): the count should be zero, a rise
always fails (even under ``--auto-lower``), and every fall is banked
automatically by the ``--auto-lower`` path so the gain cannot be spent
again. Fails CLOSED on an unreadable Makefile, git index, or baseline,
and on a run over zero documents or zero judged identifiers.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import subprocess
import sys
from pathlib import Path

DOC_PATHSPECS = ("docs", ".claude/rules", "CLAUDE.md")
EXEMPT_MARKER = "doc-ref-exempt:"

INLINE_CODE_RE = re.compile(r"`([^`]+)`")
FENCE_RE = re.compile(r"^\s*```\s*([A-Za-z0-9_-]*)")
MAKE_INVOCATION_RE = re.compile(r"^make\s+([a-z][a-z0-9_-]+)((\s+[A-Za-z_]+=\S+)*)$")
MAKEFILE_TARGET_DEF_RE = re.compile(r"^([A-Za-z][A-Za-z0-9_.-]*):(?!=)")
CONSTANT_RE = re.compile(r"^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$")
# Docs often name a constant WITH its value (`LICENSING_ENABLED = False`,
# precedent 1). The claim is the name; the value is not judged.
CONSTANT_ASSIGNMENT_RE = re.compile(r"^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\s*=\s*\S+$")
PATH_CHARS_RE = re.compile(r"^[A-Za-z0-9_.@/\-*?\[\]]+$")


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True
    )


def _tracked_docs(root: Path) -> list[Path]:
    proc = _git(root, "ls-files", "-z", "--cached", "--", *DOC_PATHSPECS)
    if proc.returncode != 0:
        raise RuntimeError(
            f"git ls-files failed under {root}: {proc.stderr.strip() or 'no git index'}"
        )
    rels = [r for r in proc.stdout.split("\0") if r.endswith(".md")]
    return [root / r for r in rels if (root / r).exists()]


def _make_targets(root: Path) -> set[str]:
    makefile = root / "Makefile"
    if not makefile.is_file():
        raise RuntimeError(f"no Makefile at {makefile} - cannot verify make targets")
    targets: set[str] = set()
    for line in makefile.read_text(encoding="utf-8", errors="replace").splitlines():
        m = MAKEFILE_TARGET_DEF_RE.match(line)
        if m:
            targets.add(m.group(1))
    if not targets:
        raise RuntimeError(f"parsed 0 targets from {makefile} - refusing to judge against nothing")
    return targets


def _tracked_files(root: Path) -> tuple[set[str], set[str]]:
    proc = _git(root, "ls-files", "-z")
    if proc.returncode != 0:
        raise RuntimeError(f"git ls-files failed under {root}")
    files = {r for r in proc.stdout.split("\0") if r}
    prefixes: set[str] = set()
    for f in files:
        parts = f.split("/")
        for i in range(1, len(parts)):
            prefixes.add("/".join(parts[:i]))
    if not files:
        raise RuntimeError("git ls-files returned no tracked files")
    return files, prefixes


def _top_level_entries(files: set[str]) -> set[str]:
    """First path segment of every tracked file - the judged-path anchor."""
    return {f.split("/", 1)[0] for f in files if "/" in f}


PLACEHOLDER_RE = re.compile(
    r"(^|/)(v?X\.Y(\.Z)?|YYYY([-_]MM([-_]DD)?)?|N|<[^>]+>|\{[^}]+\})(/|\.|$)"
)


def _looks_like_path(token: str, top_level: set[str]) -> bool:
    """A judged path starts at a REAL top-level entry of this repository.

    Without that anchor the class silently swallows editor-relative
    fragments, foreign owner/repo slugs and package names - none of which
    this repository can be asked to contain.
    """
    if "/" not in token or " " in token or "://" in token:
        return False
    if token.startswith(("/", "~", "@")) or ".." in token or "$" in token:
        return False
    if PLACEHOLDER_RE.search(token):
        return False
    if not PATH_CHARS_RE.match(token):
        return False
    return token.split("/", 1)[0] in top_level


def _path_exists(token: str, files: set[str], prefixes: set[str]) -> bool:
    clean = token.rstrip("/")
    if any(ch in clean for ch in "*?["):
        return any(fnmatch.fnmatch(f, clean) for f in files)
    if clean in files or clean in prefixes:
        return True
    # Gitignored bootstrap configs are real files the app creates from a
    # tracked template on first boot (lessons/backend.md "Gitignored config
    # + stale example"). The tracked sibling proves the reference.
    return any(f"{clean}{suffix}" in files for suffix in (".example", ".template", ".sample"))


class RefChecker:
    def __init__(self, root: Path):
        self.root = root
        self.targets = _make_targets(root)
        self.files, self.prefixes = _tracked_files(root)
        self.top_level = _top_level_entries(self.files)
        self._constant_cache: dict[str, bool] = {}
        self.findings: list[str] = []
        self.counts = {"make": 0, "path": 0, "const": 0}

    def _constant_exists(self, name: str) -> bool:
        if name not in self._constant_cache:
            proc = _git(
                self.root,
                "grep",
                "-I",
                "-l",
                "--fixed-strings",
                name,
                "--",
                ".",
                ":(exclude)docs",
                ":(exclude).claude",
                ":(exclude)CLAUDE.md",
            )
            self._constant_cache[name] = proc.returncode == 0 and bool(proc.stdout.strip())
        return self._constant_cache[name]

    def _judge(self, rel: str, lineno: int, token: str) -> None:
        m = MAKE_INVOCATION_RE.match(token)
        if m:
            self.counts["make"] += 1
            if m.group(1) not in self.targets:
                self.findings.append(f"{rel}:{lineno}: make target `{m.group(1)}` does not exist")
            return
        if _looks_like_path(token, self.top_level):
            self.counts["path"] += 1
            if not _path_exists(token, self.files, self.prefixes):
                self.findings.append(f"{rel}:{lineno}: repo path `{token}` does not exist")
            return
        assignment = CONSTANT_ASSIGNMENT_RE.match(token)
        name = assignment.group(1) if assignment else token
        if CONSTANT_RE.match(name) and len(name) >= 4:
            self.counts["const"] += 1
            if not self._constant_exists(name):
                self.findings.append(f"{rel}:{lineno}: constant/env `{name}` not found in code")

    def check_file(self, path: Path) -> None:
        rel = str(path.relative_to(self.root))
        fence_lang: str | None = None
        for lineno, line in enumerate(
            path.read_text(encoding="utf-8", errors="replace").splitlines(), start=1
        ):
            fence = FENCE_RE.match(line)
            if fence:
                fence_lang = None if fence_lang is not None else fence.group(1).lower()
                continue
            if EXEMPT_MARKER in line:
                continue
            if fence_lang is not None:
                # Inside a fence: only makefile fences make claims - a
                # target DEFINITION presents that target as existing.
                # Every other fence is a command line / example: unjudged.
                if fence_lang in ("makefile", "make"):
                    m = MAKEFILE_TARGET_DEF_RE.match(line)
                    if m:
                        self.counts["make"] += 1
                        if m.group(1) not in self.targets:
                            self.findings.append(
                                f"{rel}:{lineno}: makefile fence claims target "
                                f"`{m.group(1)}` which does not exist"
                            )
                continue
            for token in INLINE_CODE_RE.findall(line):
                self._judge(rel, lineno, token.strip())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    ap.add_argument("--baseline", type=Path, default=None)
    ap.add_argument(
        "--auto-lower",
        action="store_true",
        help="bank a fall (error counter, #2235); a rise still fails",
    )
    args = ap.parse_args(argv)
    root = args.root.resolve()
    baseline_path = args.baseline or (root / "docs" / ".doc-refs-baseline.json")

    try:
        docs = _tracked_docs(root)
        checker = RefChecker(root)
    except RuntimeError as exc:
        print(f"FAIL doc-refs: {exc} (fail-closed)")
        return 1
    if not docs:
        print(f"FAIL doc-refs: scanned 0 tracked docs under {root} (fail-closed)")
        return 1
    for doc in docs:
        checker.check_file(doc)

    judged = sum(checker.counts.values())
    total = len(checker.findings)
    print(
        f"doc-refs: scanned {len(docs)} tracked docs (git index), judged {judged} "
        f"identifiers (make-targets: {checker.counts['make']}, "
        f"paths: {checker.counts['path']}, constants: {checker.counts['const']}), "
        f"{total} broken"
    )
    if judged == 0:
        print("FAIL doc-refs: judged 0 identifiers - an empty scan is not a clean one (fail-closed)")
        return 1

    try:
        ceiling = int(json.loads(baseline_path.read_text(encoding="utf-8"))["broken_ref_count"])
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"FAIL doc-refs: baseline unreadable at {baseline_path} ({exc}) (fail-closed)")
        return 1

    if total > ceiling:
        print(f"FAIL doc-refs: broken references rose {ceiling} -> {total}:")
        for f in checker.findings:
            print(f"  {f}")
        return 1
    if total < ceiling:
        if args.auto_lower:
            baseline_path.write_text(
                json.dumps(
                    {
                        "broken_ref_count": total,
                        "rationale": (
                            "Error-counter ratchet over nameable doc references "
                            "(#2254): should be zero, a rise always fails, every "
                            "fall is banked automatically (#2235 three-way "
                            "distinction). Inherited legacy findings only."
                        ),
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            print(f"doc-refs: auto-lowered baseline {ceiling} -> {total} (improvement banked)")
            return 0
        print(
            f"FAIL doc-refs: count fell {ceiling} -> {total} without banking the gain.\n"
            "  Run: python3 scripts/verify_doc_refs.py --auto-lower"
        )
        return 1
    if total:
        print(f"doc-refs: {total} inherited finding(s) at the baseline ceiling:")
        for f in checker.findings:
            print(f"  {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
