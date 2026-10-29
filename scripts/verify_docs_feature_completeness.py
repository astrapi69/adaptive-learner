"""Feature-completeness heuristic for scripts/verify_docs.py.

Moved out of ``verify_docs.py`` unchanged so the verifier stays under the
file-size gate (950 lines), the same split as the other
``verify_docs_*`` modules. The check WARNs when README.md mentions none
of the key words of a changelog feature heading shipped since the
README's version badge. It is heuristic, so its findings stay WARN.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from pathlib import Path
from typing import Protocol


class _Report(Protocol):
    def warn(self, check: str, message: str) -> None: ...


_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "from",
    "into",
    "via",
    "per",
    "new",
    "all",
    "now",
    "add",
    "added",
    "fix",
    "fixed",
    "more",
    "also",
    "plus",
    "system",
    "support",
    "mode",
    "page",
    "phase",
    "release",
    "this",
    "that",
    "across",
}

# Generic changelog section headings -- not feature names, skip them.
_SECTION_HEADINGS = {
    "added",
    "changed",
    "fixed",
    "removed",
    "deprecated",
    "security",
    "notes",
    "quality",
    "under the hood",
    "also in this release",
    "dependencies",
    "decisions confirmed in this release",
    "what's new",
    "breaking changes",
    "migration",
    "tests",
    "documentation",
}


def changelog_versions(repo: Path) -> list[tuple[tuple[int, int, int], Path]]:
    out = []
    for path in (repo / "changelog" / "releases").glob("v*.md"):
        m = re.match(r"v(\d+)\.(\d+)\.(\d+)\.md$", path.name)
        if m:
            out.append(((int(m[1]), int(m[2]), int(m[3])), path))
    return sorted(out)


def check_feature_completeness(
    report: _Report,
    repo: Path,
    read: Callable[[Path], str] = lambda p: p.read_text(encoding="utf-8"),
) -> None:
    """WARN when README.md seems not to mention a feature shipped since its badge."""
    readme = repo / "README.md"
    if not readme.exists():
        return
    readme_text = read(readme).lower()

    # README badge version marks "what the README was last refreshed to".
    bmatch = re.search(r"badge/version-v(\d+)\.(\d+)\.(\d+)-blue", read(readme))
    since = (int(bmatch[1]), int(bmatch[2]), int(bmatch[3])) if bmatch else (0, 0, 0)

    missing: list[str] = []
    for version, path in changelog_versions(repo):
        if version <= since:
            continue
        for heading in re.findall(r"(?m)^###\s+(.+?)\s*$", read(path)):
            # Drop generic section labels (e.g. "Changed", "Fixed") and
            # anything that reads as a bug-line rather than a feature.
            clean = re.sub(r"\s*[—–-]\s*.*$", "", heading).strip().lower()
            if clean in _SECTION_HEADINGS or heading.strip().lower() in _SECTION_HEADINGS:
                continue
            if re.match(r"(?i)^bug\b", heading.strip()):
                continue
            tokens = [
                t
                for t in re.findall(r"[A-Za-z][A-Za-z0-9+-]{2,}", heading.lower())
                if t not in _STOPWORDS
            ]
            if not tokens:
                continue
            # If NONE of the heading's key tokens appear in the README,
            # the feature is likely unmentioned.
            if not any(t in readme_text for t in tokens):
                vstr = ".".join(str(p) for p in version)
                missing.append(f'v{vstr}: "{heading}"')

    if missing:
        shown = missing[:12]
        more = f" (+{len(missing) - len(shown)} more)" if len(missing) > len(shown) else ""
        report.warn(
            "feature-completeness",
            "README.md may not mention features shipped since its version badge: "
            + "; ".join(shown)
            + more,
        )
