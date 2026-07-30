#!/usr/bin/env python3
"""Bidirectional gate <-> rule coupling check (#2075).

The #1640 visual-baseline gate kept running while its rule section had
been deleted: enforcement without a documented rule, undetected. This
script makes that divergence impossible in BOTH directions.

Forward  - every gate in ``.claude/rules/gates.yaml`` must name an
           existing workflow AND an existing rule section (file +
           heading anchor).
Backward - every workflow filename mentioned inside a rule file must
           exist; a rule may not cite a retired gate.
Coverage - every workflow in ``.github/workflows`` must appear either
           under ``gates:`` or under ``no_rule:``; a new workflow cannot
           slip in unclassified.

Stdlib only (a hand-rolled reader for the small, fixed manifest shape -
no PyYAML dependency, so pre-commit and CI can run it anywhere).

Usage::

    python3 scripts/verify_gate_rule_links.py
    python3 scripts/verify_gate_rule_links.py --repo-root /path/to/tree

Exit codes: 0 ok, 1 drift.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

WORKFLOW_RE = re.compile(r"\b([a-z0-9][a-z0-9._-]*\.yml)\b")
PATH_CITE_RE = re.compile(r"\.github/workflows/([a-z0-9][a-z0-9._-]*\.yml)")
WORKFLOWISH_RE = re.compile(
    r"^[a-z0-9-]+-(gate|check|smoke|parity|scan|regression|sync|automation)\.yml$"
)


def slugify(heading: str) -> str:
    """GitHub-style anchor slug for a markdown heading."""
    text = heading.strip().lower()
    text = re.sub(r"[`*_\[\]()]", "", text)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    return re.sub(r"\s+", "-", text).strip("-")


def parse_manifest(path: Path) -> tuple[list[dict[str, str]], dict[str, str], dict[str, str]]:
    """Read the fixed-shape manifest: a ``gates:`` list and a ``no_rule:`` map."""
    gates: list[dict[str, str]] = []
    no_rule: dict[str, str] = {}
    retired: dict[str, str] = {}
    section = None
    current: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").split("\n"):
        # NB: values carry anchors ("file.md#section"), so inline "#" is NOT a
        # comment; only a full-line "#" is.
        line = "" if raw.strip().startswith("#") else raw.rstrip()
        if not line.strip():
            continue
        if line.startswith("gates:"):
            section = "gates"
            continue
        if line.startswith("no_rule:"):
            if current:
                gates.append(current)
                current = {}
            section = "no_rule"
            continue
        if line.startswith("retired:"):
            section = "retired"
            continue
        if section == "gates":
            stripped = line.strip()
            if stripped.startswith("- "):
                if current:
                    gates.append(current)
                current = {}
                stripped = stripped[2:]
            key, _, value = stripped.partition(":")
            current[key.strip()] = value.strip()
        elif section in ("no_rule", "retired"):
            key, _, value = line.strip().partition(":")
            (no_rule if section == "no_rule" else retired)[key.strip()] = value.strip()
    if current:
        gates.append(current)
    return gates, no_rule, retired


def section_body(path: Path, anchor: str) -> str | None:
    """The body of the ``##`` section whose slug is ``anchor`` (heading included)."""
    if not path.is_file():
        return None
    cur: str | None = None
    buf: list[str] = []
    for line in path.read_text(encoding="utf-8").split("\n"):
        if line.startswith("## "):
            if cur == anchor:
                return "\n".join(buf)
            cur, buf = slugify(line[3:]), [line]
        elif cur is not None:
            buf.append(line)
    return "\n".join(buf) if cur == anchor else None


def body_digest(body: str) -> str:
    """Same digest shape as the lessons inventory (#2073) - one convention."""
    return hashlib.sha256(body.strip().encode("utf-8")).hexdigest()[:16]


def headings(path: Path) -> set[str]:
    """Anchor slugs of every ``##``+ heading in a markdown file."""
    if not path.is_file():
        return set()
    return {
        slugify(line.lstrip("#").strip())
        for line in path.read_text(encoding="utf-8").split("\n")
        if line.startswith("##")
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo-root", default=None, help="check a different tree (used by the RED test)"
    )
    args = parser.parse_args()

    root = (
        Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parent.parent
    )
    rules_dir = root / ".claude" / "rules"
    workflows_dir = root / ".github" / "workflows"
    manifest = rules_dir / "gates.yaml"

    if not manifest.is_file():
        print(f"missing manifest: {manifest}", file=sys.stderr)
        return 1

    gates, no_rule, retired = parse_manifest(manifest)
    existing = {p.name for p in workflows_dir.glob("*.yml")}
    problems: list[str] = []

    # Forward: gate -> workflow + rule anchor
    for gate in gates:
        wf, target = gate.get("workflow", ""), gate.get("enforces", "")
        if wf not in existing:
            problems.append(f"gate '{wf}' is in the manifest but the workflow does not exist")
        rel, _, anchor = target.partition("#")
        rule_path = rules_dir / rel
        if not rule_path.is_file():
            problems.append(f"gate '{wf}' enforces '{target}' but {rel} does not exist")
        elif anchor not in headings(rule_path):
            problems.append(
                f"gate '{wf}' enforces '{target}' but that section is missing from {rel}"
            )
        else:
            # Existence is not content (#2079): keeping the heading while
            # hollowing out the body used to pass. The declared body_sha pins
            # the text the gate actually enforces; changing it means updating
            # the hash, which shows up in the diff and in review.
            declared_sha = gate.get("body_sha", "")
            body = section_body(rule_path, anchor)
            if not declared_sha:
                problems.append(f"gate '{wf}' has no body_sha for '{target}' - add it")
            elif body is None or body_digest(body) != declared_sha:
                problems.append(
                    f"gate '{wf}': the body of '{target}' changed "
                    f"(declared {declared_sha}, actual {body_digest(body or '')}) - "
                    f"review the change, then update body_sha in gates.yaml"
                )

    # Backward: rule text -> workflow must exist. Only WORKFLOW citations
    # count: either an explicit .github/workflows/ path, or a bare name in
    # the workflow-ish shape (*-gate/-check/-smoke/-parity.yml). Compose
    # files, action.yml and mkdocs.yml are not workflows and never match.
    for rule_file in sorted(rules_dir.rglob("*.md")):
        for line in rule_file.read_text(encoding="utf-8").split("\n"):
            cited = set(PATH_CITE_RE.findall(line))
            cited |= {n for n in WORKFLOW_RE.findall(line) if WORKFLOWISH_RE.match(n)}
            for name in sorted(cited):
                if name in existing or name in retired:
                    continue
                problems.append(
                    f"{rule_file.relative_to(root)} cites workflow '{name}', which does not exist "
                    f"(retire it in gates.yaml if the citation is historical)"
                )

    # Coverage: every workflow classified
    classified = {g.get("workflow", "") for g in gates} | set(no_rule)
    for name in sorted(existing - classified):
        problems.append(f"workflow '{name}' is in neither gates: nor no_rule: - classify it")

    for problem in problems:
        print(f"GATE-RULE DRIFT: {problem}", file=sys.stderr)
    if problems:
        print(f"\n{len(problems)} problem(s)", file=sys.stderr)
        return 1
    print(
        f"gate<->rule links OK: {len(gates)} gates coupled, {len(no_rule)} deliberately uncoupled"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
