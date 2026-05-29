#!/usr/bin/env python3
"""Generate a post-release documentation checklist from a changelog.

Stdlib only. Reads ``changelog/releases/v{VERSION}.md``, extracts the
feature headings, and prints a Markdown checklist of the docs that
likely need updating for that release. It does NOT understand code --
it just turns the changelog's feature names into a to-do list so the
releaser sees exactly what to touch.

Pairs with ``verify_docs.py``: the checklist tells a human what to
write; the verifier then proves it was written (version/counts) or
flags what still drifts (features/help).

Usage:
  python3 scripts/generate_docs_checklist.py 1.41.0
  python3 scripts/generate_docs_checklist.py v1.41.0   # 'v' optional

Printed automatically after ``make release-tag`` so the releaser sees
the doc to-do list inline.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Generic changelog section labels -- not feature names.
_SECTION_HEADINGS = {
    "added", "changed", "fixed", "removed", "deprecated", "security",
    "notes", "quality", "under the hood", "also in this release",
    "dependencies", "decisions confirmed in this release", "what's new",
    "breaking changes", "migration", "tests", "documentation",
}


def _normalize_version(raw: str) -> str:
    return raw[1:] if raw.lower().startswith("v") else raw


def _feature_headings(text: str) -> list[str]:
    """Extract feature names from '### ' headings, dropping section labels."""
    features: list[str] = []
    for heading in re.findall(r"(?m)^###\s+(.+?)\s*$", text):
        bare = re.sub(r"\s*[—–-]\s*.*$", "", heading).strip()
        if bare.lower() in _SECTION_HEADINGS or heading.strip().lower() in _SECTION_HEADINGS:
            continue
        features.append(heading.strip())
    return features


def build_checklist(version: str) -> str:
    changelog = REPO / "changelog" / "releases" / f"v{version}.md"
    if not changelog.exists():
        raise FileNotFoundError(
            f"no changelog at {changelog.relative_to(REPO)} -- "
            f"create it before generating the checklist"
        )

    features = _feature_headings(changelog.read_text(encoding="utf-8"))

    lines = [f"## Post-Release Documentation Checklist for v{version}", ""]

    lines.append("### From changelog")
    if features:
        for feat in features:
            lines.append(f"- [ ] README.md: mention \"{feat}\"")
            lines.append(f"- [ ] README-de.md: mention \"{feat}\" (DE)")
            lines.append(f"- [ ] CLAUDE.md: update the architecture/feature notes for \"{feat}\"")
            lines.append(f"- [ ] docs/help/en/ + docs/help/de/: does \"{feat}\" need a (bilingual) help page?")
            lines.append("")
    else:
        lines.append("- (no `### ` feature headings found in the changelog)")
        lines.append("")

    lines.append("### Standard checks")
    lines.append(f"- [ ] CLAUDE.md current-state line says v{version}")
    lines.append("- [ ] CLAUDE.md test counts updated (backend + plugins + Vitest = total)")
    lines.append(f"- [ ] README.md + README-de.md version badge -> v{version}")
    lines.append("- [ ] README.md + README-de.md test badge + plugin count current")
    lines.append("- [ ] docs/ROADMAP.md: state line bumped + phase row added")
    lines.append("- [ ] docs/backlog.md: completed items archived (make archive-task)")
    lines.append("- [ ] new help pages added to docs/help/_meta.yaml + make sync-mkdocs-nav")
    lines.append("")
    lines.append("Verify when done: `make verify-docs` (0 FAIL) or `make verify-docs-discipline`.")

    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print("usage: generate_docs_checklist.py <VERSION>", file=sys.stderr)
        return 2
    version = _normalize_version(argv[0])
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        print(f"error: '{argv[0]}' is not a vMAJOR.MINOR.PATCH version", file=sys.stderr)
        return 2
    try:
        print(build_checklist(version))
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
