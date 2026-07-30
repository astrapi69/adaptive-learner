#!/usr/bin/env python3
"""Surface normative-language and gate-status changes in a PR (#2079).

The quality-checks condensation flipped "MANDATORY on UI PRs" to
"recommended but not mandatory" and added an escape clause to a PFLICHT
gate. Both were invisible inside a 561-line deletion framed as cleanup.

This script diffs the rule surface between a base ref and the working
tree and reports two classes separately, so they cannot ride along
unnoticed:

1. NORMATIVE LANGUAGE - added or removed lines in ``.claude/rules/**.md``
   that carry a binding keyword (MUST/MUSS/PFLICHT/MANDATORY/NEVER/
   NIEMALS/ALWAYS/IMMER/required/forbidden/verboten).
2. GATE STATUS - in ``.claude/rules/gates.yaml``: a gate losing its rule
   anchor (moved to ``no_rule:``), a still-existing workflow moved to
   ``retired:``, or a coupled gate disappearing. The #2075 coverage check
   forces a workflow to be CLASSIFIED, not correctly classified - this
   closes that.

Findings are not an error by themselves. They must be DECLARED: either
the PR carries the escape label, or the PR body contains a declaration
block. Passable on purpose, never passable by accident.

Usage::

    python3 scripts/verify_normative_changes.py --base origin/develop
    python3 scripts/verify_normative_changes.py --base <ref> --declared

Exit codes: 0 nothing to declare (or declared), 2 undeclared changes.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

NORMATIVE_RE = re.compile(
    r"\b(MUST|MUSS|MÜSSEN|PFLICHT|MANDATORY|NEVER|NIEMALS|ALWAYS|IMMER|REQUIRED|FORBIDDEN|VERBOTEN)\b",
    re.IGNORECASE,
)
DECLARATION_MARKER = "RULE-CHANGE DECLARED"
# A rule file that loses this much text is never "just formatting" (#2081).
# Either threshold trips: a fifth of the file, or 1500 bytes outright. The
# incident lost 66 percent of quality-checks.md under a "condensation" label.
SIZE_DROP_RATIO = 0.20
SIZE_DROP_BYTES = 1500
ESCAPE_LABEL = "rule-change-declared"
RULES_GLOB = ".claude/rules"


def git(root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=root, capture_output=True, text=True, check=False
    ).stdout


def normative_findings(root: Path, base: str) -> list[str]:
    """Added/removed rule lines that carry a binding keyword."""
    # Diff the DIRECTORY, not a "**.md" pathspec: git does not expand "**"
    # without :(glob) magic, so the pattern silently matched almost nothing -
    # a gate that passes by looking at the wrong thing (the very class this
    # gate exists for). Markdown filtering happens here instead.
    diff = git(root, "diff", "-U0", base, "--", RULES_GLOB)
    findings: list[str] = []
    current = "?"
    for line in diff.split("\n"):
        if line.startswith("+++ b/"):
            current = line[6:]
            continue
        if line.startswith(("+++", "---")):
            continue
        if not current.endswith(".md"):
            continue
        if line[:1] in "+-" and NORMATIVE_RE.search(line[1:]):
            verb = "added" if line[0] == "+" else "removed"
            findings.append(f"{current}: {verb}: {line[1:].strip()[:140]}")
    return findings


def size_drop_findings(root: Path, base: str) -> list[str]:
    """Rule files that shrank enough that "cosmetic" is not a credible label."""
    changed = git(root, "diff", "--name-only", base, "--", RULES_GLOB).split("\n")
    findings: list[str] = []
    for rel in sorted(f for f in changed if f.endswith(".md")):
        old = git(root, "show", f"{base}:{rel}")
        if not old:
            continue
        path = root / rel
        new_len = len(path.read_text(encoding="utf-8")) if path.is_file() else 0
        lost = len(old) - new_len
        if lost <= 0:
            continue
        ratio = lost / len(old)
        if ratio >= SIZE_DROP_RATIO or lost >= SIZE_DROP_BYTES:
            findings.append(
                f"{rel}: lost {lost} bytes ({ratio:.0%} of the file) - "
                f"a drop this size is a content change, not formatting"
            )
    return findings


def gate_status_findings(root: Path, base: str) -> list[str]:
    """Weakening moves inside gates.yaml: decoupled, retired, or dropped."""
    path = f"{RULES_GLOB}/gates.yaml"
    old = git(root, "show", f"{base}:{path}")
    new = (root / path).read_text(encoding="utf-8") if (root / path).is_file() else ""
    if not old:
        return []

    def coupled(text: str) -> dict[str, str]:
        out: dict[str, str] = {}
        workflow = None
        for line in text.split("\n"):
            stripped = line.strip()
            if stripped.startswith("- workflow:"):
                workflow = stripped.split(":", 1)[1].strip()
            elif stripped.startswith("enforces:") and workflow:
                out[workflow] = stripped.split(":", 1)[1].strip()
                workflow = None
        return out

    def listed(text: str, section: str) -> set[str]:
        out: set[str] = set()
        active = False
        for line in text.split("\n"):
            if line.startswith(f"{section}:"):
                active = True
                continue
            if line and not line[0].isspace() and not line.startswith("#"):
                active = False
            if active and line.strip() and not line.strip().startswith("#"):
                out.add(line.strip().split(":", 1)[0])
        return out

    findings: list[str] = []
    old_coupled, new_coupled = coupled(old), coupled(new)
    new_no_rule, new_retired = listed(new, "no_rule"), listed(new, "retired")
    workflows = {p.name for p in (root / ".github" / "workflows").glob("*.yml")}

    for workflow, anchor in old_coupled.items():
        if workflow in new_coupled:
            if new_coupled[workflow] != anchor:
                findings.append(
                    f"gate '{workflow}' now enforces '{new_coupled[workflow]}' (was '{anchor}')"
                )
            continue
        if workflow in new_no_rule:
            findings.append(
                f"gate '{workflow}' was decoupled from '{anchor}' and moved to no_rule:"
            )
        elif workflow in new_retired:
            state = "still exists" if workflow in workflows else "is gone"
            findings.append(f"gate '{workflow}' moved to retired: while the workflow {state}")
        else:
            findings.append(
                f"gate '{workflow}' (enforcing '{anchor}') disappeared from the manifest"
            )

    for workflow in sorted(new_retired - listed(old, "retired")):
        if workflow in workflows:
            findings.append(f"'{workflow}' was declared retired: but the workflow still exists")
    return findings


def declared(root: Path, base: str, forced: bool, pr_body: str | None) -> bool:
    if forced:
        return True
    body = pr_body or ""
    if DECLARATION_MARKER in body:
        return True
    # Fall back to the commit range: a declaration in any commit message counts.
    log = git(root, "log", f"{base}..HEAD", "--format=%B")
    return DECLARATION_MARKER in log


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="origin/develop", help="base ref to diff against")
    parser.add_argument("--repo-root", default=None)
    parser.add_argument("--declared", action="store_true", help="the escape label is present")
    parser.add_argument("--pr-body", default=None, help="PR body text to scan for the declaration")
    args = parser.parse_args()

    root = (
        Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent
    )
    findings = [("normative language", f) for f in normative_findings(root, args.base)]
    findings += [("gate status", f) for f in gate_status_findings(root, args.base)]
    findings += [("size drop", f) for f in size_drop_findings(root, args.base)]

    if not findings:
        print(f"no normative or gate-status changes against {args.base}")
        return 0

    print(f"{len(findings)} rule-surface change(s) against {args.base}:")
    for kind, finding in findings:
        print(f"  [{kind}] {finding}")

    if declared(root, args.base, args.declared, args.pr_body):
        print("\nDeclared - the author owns these changes. OK.")
        return 0

    print(
        f"\nUNDECLARED. A binding rule may not change - and a rule file may not\n"
        f"shrink substantially - inside an undeclared diff.\n"
        f"Declare it: add the '{ESCAPE_LABEL}' label to the PR, or put a line\n"
        f"'{DECLARATION_MARKER}: <what changes and why>' in the PR body or a commit message.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
