#!/usr/bin/env python3
"""Documentation drift verifier for Adaptive Learner.

Stdlib only (tomllib, json, re, pathlib, subprocess, argparse). No pip
deps -- this script must run with a bare ``python3`` in CI before any
project venv exists.

After every release the documentation drifts: version badges, plugin
counts, test counts, feature lists, help pages, mkdocs nav, i18n
catalogs and theme tokens all go stale. This verifier catches that
drift BEFORE a release ships.

Severity model (matches the Bibliogon precedent):

  FAIL  Hard contract with no false positives on a correct repo.
        Blocks the release. Exit code 1.
  WARN  Real signal, but heuristic or count-based -- a wrong FAIL
        here would block a correct state. Advisory only. Exit code 0.

Exit codes:
  0  clean (no FAIL findings; WARN findings may be present)
  1  drift found (at least one FAIL finding)
  2  the verifier itself could not run (missing canonical source, ...)

Usage:
  python3 scripts/verify_docs.py            # run every check
  python3 scripts/verify_docs.py --check version,plugins
  python3 scripts/verify_docs.py --list     # list registered checks
  python3 scripts/verify_docs.py --fix      # best-effort auto-fix
  python3 scripts/verify_docs.py --test-counts   # also run pytest/vitest
                                                 # collection (slow)

``--fix`` is BEST EFFORT and never silently corrupts docs: only
mechanically-safe drift (version badges, counts, the test-total
arithmetic, i18n sync) is rewritten. Anything that needs human
writing (stale dated prose, missing help pages, feature lists) is
flagged, never edited.
"""

from __future__ import annotations

import argparse
import re
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

FAIL = "FAIL"
WARN = "WARN"

# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


@dataclass
class Finding:
    severity: str
    check: str
    message: str
    fixed: bool = False


@dataclass
class Report:
    findings: list[Finding] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def fail(self, check: str, message: str, fixed: bool = False) -> None:
        self.findings.append(Finding(FAIL, check, message, fixed))

    def warn(self, check: str, message: str, fixed: bool = False) -> None:
        self.findings.append(Finding(WARN, check, message, fixed))

    def note(self, message: str) -> None:
        self.notes.append(message)

    @property
    def fail_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == FAIL and not f.fixed)

    @property
    def warn_count(self) -> int:
        return sum(1 for f in self.findings if f.severity == WARN and not f.fixed)

    @property
    def fixed_count(self) -> int:
        return sum(1 for f in self.findings if f.fixed)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def canonical_version() -> str:
    """Read the single source of truth from backend/pyproject.toml."""
    pyproject = REPO / "backend" / "pyproject.toml"
    data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    return data["tool"]["poetry"]["version"]


def plugin_count() -> int:
    """Count shipped plugin packages on disk."""
    return len(list((REPO / "plugins").glob("adaptive-learner-plugin-*")))


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def replace_group(text: str, pattern: str, value: str) -> tuple[str, int]:
    """Replace capture group 1 of the first match with ``value``.

    Returns ``(new_text, n_replacements)``. Used by --fix to swap a
    stale token in place without disturbing the surrounding text.
    """
    flags = re.DOTALL if "(?s)" not in pattern else 0

    def repl(match: re.Match) -> str:
        whole = match.group(0)
        # Replace only the captured slice, anchored at its position
        # inside the match so identical substrings elsewhere are safe.
        start = match.start(1) - match.start(0)
        end = match.end(1) - match.start(0)
        return whole[:start] + value + whole[end:]

    return re.subn(pattern, repl, text, count=1, flags=flags)


# ---------------------------------------------------------------------------
# Check: version consistency  (FAIL)
# ---------------------------------------------------------------------------

# Each entry: (relative path, regex with one version capture group,
# human label, fixable).  "fixable" is False when the version is
# embedded in dated/phase prose that --fix must not naively rewrite.
#
# The fixable display sites come from scripts/version_display_sites.py -
# the SAME list sync_versions.py rewrites on a bump (#2179), so the
# writer and this checker cannot know different sites.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from version_display_sites import VERSION_DISPLAY_SITES  # noqa: E402

VERSION_TARGETS = [
    (rel, pattern, label, True) for rel, pattern, label in VERSION_DISPLAY_SITES
] + [
    # CLAUDE.md deliberately carries NO inline version since the #2071
    # condensation: it points at backend/pyproject.toml as the canonical
    # source, so there is nothing here to compare. The test-count line
    # (checked separately below) still carries a vX.Y.Z baseline label.
    ("docs/ROADMAP.md", r"Current state: \*\*v(\d+\.\d+\.\d+)", "ROADMAP.md header", False),
    ("docs/backlog.md", r"State: \*\*post v(\d+\.\d+\.\d+)", "backlog.md header", False),
]


def check_version(report: Report, fix: bool) -> None:
    canonical = canonical_version()
    for rel, pattern, label, fixable in VERSION_TARGETS:
        path = REPO / rel
        if not path.exists():
            report.fail("version", f"{label}: file {rel} is missing")
            continue
        text = read(path)
        match = re.search(pattern, text)
        if not match:
            report.fail("version", f"{label}: no version string found in {rel} (pattern drift)")
            continue
        found = match.group(1)
        if found == canonical:
            continue
        if fix and fixable:
            new_text, n = replace_group(text, pattern, canonical)
            if n:
                path.write_text(new_text, encoding="utf-8")
                report.fail("version", f"{label}: {found} -> {canonical} (auto-fixed)", fixed=True)
                continue
        if fixable:
            report.fail("version", f"{label}: says v{found}, canonical is v{canonical}")
        else:
            # Dated-prose headers (ROADMAP.md / backlog.md) carry the version
            # inside a hand-written "Current state" narrative, so --fix must
            # not naively rewrite them. release-workflow.md Step 11 updates
            # these as post-release documentation, so a mismatch during the
            # release cut is a reminder (WARN), not a release-blocking FAIL --
            # the version is still hard-gated on the README/CLAUDE badges and
            # the required changelog file.
            report.warn(
                "version",
                f"{label}: says v{found}, canonical is v{canonical} "
                "(dated-prose header -- refresh by hand as post-release documentation)",
            )


# ---------------------------------------------------------------------------
# Check: plugin count  (FAIL)
# ---------------------------------------------------------------------------

PLUGIN_COUNT_TARGETS = [
    ("CLAUDE.md", r"## Plugins \((\d+) shipped\)", "CLAUDE.md plugin header"),
    ("README.md", r"(?m)^(\d+) plugins, all under", "README plugin count"),
    ("README-de.md", r"(?m)^(\d+) Plugins, alle unter", "README-de plugin count"),
]


def check_plugins(report: Report, fix: bool) -> None:
    actual = plugin_count()
    for rel, pattern, label in PLUGIN_COUNT_TARGETS:
        path = REPO / rel
        if not path.exists():
            report.fail("plugins", f"{label}: file {rel} is missing")
            continue
        text = read(path)
        match = re.search(pattern, text)
        if not match:
            report.fail("plugins", f"{label}: no plugin count found in {rel} (pattern drift)")
            continue
        stated = int(match.group(1))
        if stated == actual:
            continue
        if fix:
            new_text, n = replace_group(text, pattern, str(actual))
            if n:
                path.write_text(new_text, encoding="utf-8")
                report.fail("plugins", f"{label}: {stated} -> {actual} (auto-fixed)", fixed=True)
                continue
        report.fail("plugins", f"{label}: says {stated}, {actual} plugin dirs on disk")


# ---------------------------------------------------------------------------
# Check: test counts  (WARN)
# ---------------------------------------------------------------------------

# Matches the CLAUDE.md baseline line, e.g.
#   backend 1025 (+1 skipped) + plugins 950 + Vitest 2503 = **4478 tests**
# Bold around the total is optional since the #2071 reflow.
TEST_COUNT_RE = r"backend (\d+).*?\+ plugins\s+(\d+) \+ Vitest (\d+) = \*{0,2}(\d+) tests\*{0,2}"
# README/README-de test badge, e.g. badge/tests-2634%20green  /  ...-2634%20grün
TEST_BADGE_RE = r"badge/tests-(\d+)%20"


def check_test_counts(report: Report, fix: bool, run_collection: bool) -> None:
    claude = REPO / "CLAUDE.md"
    text = read(claude)
    match = re.search(TEST_COUNT_RE, text, re.DOTALL)
    if not match:
        report.warn(
            "test-counts",
            "CLAUDE.md: could not parse the 'backend N + plugins N + Vitest N = N tests' line",
        )
        return
    backend, plugins, vitest, total = (int(g) for g in match.groups())
    summed = backend + plugins + vitest

    # Cheap internal-consistency check: the parts must add up to the total.
    if summed != total:
        if fix:
            # Rewrite only the total token; the parts are the source of truth.
            new_text, n = re.subn(
                TEST_COUNT_RE,
                lambda m: m.group(0).replace(f"**{total} tests**", f"**{summed} tests**"),
                text,
                count=1,
                flags=re.DOTALL,
            )
            if n:
                claude.write_text(new_text, encoding="utf-8")
                report.warn(
                    "test-counts",
                    f"CLAUDE.md test total {total} -> {summed} (arithmetic auto-fixed)",
                    fixed=True,
                )
        else:
            report.warn(
                "test-counts",
                f"CLAUDE.md test total is {total} but {backend}+{plugins}+{vitest}={summed}",
            )

    consistent_total = summed  # the value the badge should mirror

    # README / README-de test badges should mirror the CLAUDE total.
    for rel in ("README.md", "README-de.md"):
        path = REPO / rel
        if not path.exists():
            continue
        rtext = read(path)
        bmatch = re.search(TEST_BADGE_RE, rtext)
        if not bmatch:
            continue
        badge = int(bmatch.group(1))
        if badge == consistent_total:
            continue
        if fix:
            new_text, n = replace_group(rtext, TEST_BADGE_RE, str(consistent_total))
            if n:
                path.write_text(new_text, encoding="utf-8")
                report.warn(
                    "test-counts",
                    f"{rel} test badge {badge} -> {consistent_total} (auto-fixed)",
                    fixed=True,
                )
                continue
        report.warn(
            "test-counts", f"{rel} test badge says {badge}, CLAUDE total is {consistent_total}"
        )

    if not run_collection:
        report.note(
            "test-counts: actual pytest/vitest collection skipped (pass --test-counts to enable the 5% drift check)"
        )
        return

    actual = _collect_actual_test_counts(report)
    if actual is None:
        return
    a_backend, a_plugins, a_vitest = actual
    for label, stated, real in (
        ("backend", backend, a_backend),
        ("plugins", plugins, a_plugins),
        ("Vitest", vitest, a_vitest),
    ):
        if real == 0:
            continue
        drift = abs(stated - real) / real
        if drift > 0.05:
            report.warn(
                "test-counts",
                f"CLAUDE.md {label} count {stated} drifts {drift:.0%} from actual {real} (>5%)",
            )


def _collect_actual_test_counts(report: Report):
    """Collect real test counts via pytest/vitest. Slow; opt-in only."""
    import subprocess

    def collect_pytest(cwd: Path) -> int:
        try:
            out = subprocess.run(
                ["poetry", "run", "pytest", "--collect-only", "-q"],
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=600,
            ).stdout
        except (OSError, subprocess.SubprocessError) as exc:
            report.note(f"test-counts: pytest collection in {cwd} failed: {exc}")
            return 0
        m = re.search(r"(\d+) tests? collected", out) or re.search(
            r"(\d+)/\d+ tests collected", out
        )
        return int(m.group(1)) if m else 0

    backend = collect_pytest(REPO / "backend")
    plugins = 0
    for d in sorted((REPO / "plugins").glob("adaptive-learner-plugin-*")):
        plugins += collect_pytest(d)

    vitest = 0
    try:
        out = subprocess.run(
            ["npx", "vitest", "list"],
            cwd=REPO / "frontend",
            capture_output=True,
            text=True,
            timeout=600,
        ).stdout
        vitest = len([ln for ln in out.splitlines() if " > " in ln])
    except (OSError, subprocess.SubprocessError) as exc:
        report.note(f"test-counts: vitest list failed: {exc}")

    return backend, plugins, vitest


# ---------------------------------------------------------------------------
# Check: feature completeness  (WARN, heuristic)
# ---------------------------------------------------------------------------

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


def _changelog_versions() -> list[tuple[tuple[int, int, int], Path]]:
    out = []
    for path in (REPO / "changelog" / "releases").glob("v*.md"):
        m = re.match(r"v(\d+)\.(\d+)\.(\d+)\.md$", path.name)
        if m:
            out.append(((int(m[1]), int(m[2]), int(m[3])), path))
    return sorted(out)


def check_feature_completeness(report: Report) -> None:
    readme = REPO / "README.md"
    if not readme.exists():
        return
    readme_text = read(readme).lower()

    # README badge version marks "what the README was last refreshed to".
    bmatch = re.search(r"badge/version-v(\d+)\.(\d+)\.(\d+)-blue", read(readme))
    since = (int(bmatch[1]), int(bmatch[2]), int(bmatch[3])) if bmatch else (0, 0, 0)

    missing: list[str] = []
    for version, path in _changelog_versions():
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


# ---------------------------------------------------------------------------
# Check: stale date references  (WARN)
# ---------------------------------------------------------------------------

# Today is derived from the latest changelog release date so the check
# needs no wall-clock (keeps it deterministic in CI).
DATE_RE = re.compile(r"\b(20\d{2})-(\d{2})-(\d{2})\b")
STALE_SCAN = ["README.md", "README-de.md", "CLAUDE.md", "docs/ROADMAP.md", "docs/backlog.md"]


def _latest_release_month() -> tuple[int, int]:
    versions = _changelog_versions()
    if not versions:
        return (2026, 5)
    _, path = versions[-1]
    m = re.search(r"\*\*Released?\*\*:?\s*(20\d{2})-(\d{2})-(\d{2})", read(path)) or re.search(
        r"Released?:?\s*(20\d{2})-(\d{2})-(\d{2})", read(path)
    )
    if m:
        return (int(m[1]), int(m[2]))
    return (2026, 5)


def check_stale_dates(report: Report) -> None:
    year, month = _latest_release_month()
    # "More than 2 months old" relative to the latest release.
    cutoff = year * 12 + month - 2

    for rel in STALE_SCAN:
        path = REPO / rel
        if not path.exists():
            continue
        stale: list[str] = []
        for line in read(path).splitlines():
            for ym in DATE_RE.finditer(line):
                y, mo = int(ym[1]), int(ym[2])
                if y * 12 + mo < cutoff:
                    stale.append(f"{ym.group(0)}")
        if stale:
            uniq = sorted(set(stale))
            shown = uniq[:6]
            more = f" (+{len(uniq) - len(shown)} more)" if len(uniq) > len(shown) else ""
            report.warn(
                "stale-dates",
                f"{rel}: current-state doc references dates older than 2 months: {', '.join(shown)}{more}",
            )


# ---------------------------------------------------------------------------
# Check: CSS theme completeness  (FAIL)
# ---------------------------------------------------------------------------

THEME_VAR_RE = re.compile(r"^\s*(--[a-z0-9-]+)\s*:", re.MULTILINE)


def check_themes(report: Report) -> None:
    theme_dir = REPO / "frontend" / "src" / "styles" / "themes"
    files = sorted(theme_dir.glob("theme-*.css"))
    if not files:
        report.warn("themes", f"no theme-*.css files under {theme_dir}")
        return

    per_theme: dict[str, set[str]] = {}
    for path in files:
        per_theme[path.name] = set(THEME_VAR_RE.findall(read(path)))

    # The expected token set is the union across all themes; any theme
    # missing a token another theme defines is a hole that renders a
    # legacy/fallback colour. Mirrors styles/themes/themes.test.ts.
    expected = set().union(*per_theme.values())
    for name, tokens in per_theme.items():
        missing = expected - tokens
        if missing:
            report.fail(
                "themes",
                f"{name} is missing {len(missing)} token(s) defined in sibling themes: "
                + ", ".join(sorted(missing)[:8])
                + (" ..." if len(missing) > 8 else ""),
            )


# ---------------------------------------------------------------------------
# Check: mkdocs nav orphans + dead links  (FAIL)
# ---------------------------------------------------------------------------

# Help-site index pages must be VERSIONLESS (#1766): the deployed front
# pages drifted into three different stale claims (de/en v1.91.0, es/ja
# v1.47.0, tr/el v1.20.0) because nothing gated them. Any v-prefixed
# version-shape literal on an index page fails hard - link to the GitHub
# Releases page instead of hardcoding a number.
HELP_INDEX_VERSION_RE = re.compile(r"\bv\d+\.\d+(?:\.\d+)?\b")


def check_help_index_versions(report: Report, help_dir: Path | None = None) -> None:
    """FAIL on any vX.Y[.Z] literal in docs/help/*/index.md (#1766)."""
    root = help_dir if help_dir is not None else REPO / "docs" / "help"
    index_pages = sorted(root.glob("*/index.md"))
    if not index_pages:
        report.warn("help-index-versions", f"no index pages found under {root}")
        return
    for page in index_pages:
        for line_number, line in enumerate(read(page).splitlines(), start=1):
            for match in HELP_INDEX_VERSION_RE.finditer(line):
                report.fail(
                    "help-index-versions",
                    f"{page.parent.name}/index.md:{line_number}: version literal "
                    f"{match.group(0)} (help index pages are versionless - "
                    "link to GitHub Releases instead, #1766)",
                )


# End-user help prose must be VERSIONLESS (#1767): the help tree carried
# ~1000 "since vX.Y" feature-provenance markers across 8 locales that
# drift per-locale and read as noise to an end user ("since v1.35.0" on a
# v2.x app implies a recency/optionality that is long gone). User help
# describes the CURRENT behaviour; release provenance belongs to
# changelog/releases/. This gate extends the #1766 index check to the
# whole user-facing help tree.
#
# Out of scope (not gated here, per the #1767 scope decision):
#   - developer/ + api/ trees: contributor/integrator reference that
#     legitimately cites schema + hook versions (schema v1.4,
#     ai_complete_async v1.5.0). A different audience, a different
#     contract.
#   - changelog.md: the per-locale "What's new" page is version-based by
#     definition; gating it line-by-line would be absurd.
#   - index.md: already hard-gated by check_help_index_versions above.
#
# Genuine exceptions (a version literal that carries real, current
# meaning) get an inline `<!-- version-exempt: <reason> -->` marker on
# the same line, mirroring the design-token `token-exempt:` precedent.
HELP_PROSE_EXEMPT_DIRS = {"developer", "api"}
HELP_PROSE_EXEMPT_FILES = {"index.md", "changelog.md"}
VERSION_EXEMPT_RE = re.compile(r"<!--\s*version-exempt:")


def check_help_prose_versions(report: Report, help_dir: Path | None = None) -> None:
    """FAIL on any vX.Y[.Z] literal in user-facing docs/help prose (#1767).

    Gates every ``docs/help/<locale>/**/*.md`` page except the
    developer/ + api/ reference trees, the per-locale changelog.md, and
    index.md (which has its own check). Lines carrying a
    ``<!-- version-exempt: ... -->`` marker are skipped.
    """
    root = help_dir if help_dir is not None else REPO / "docs" / "help"
    pages = sorted(root.glob("*/**/*.md"))
    if not pages:
        report.warn("help-prose-versions", f"no help pages found under {root}")
        return
    for page in pages:
        rel_parts = page.relative_to(root).parts  # (locale, ...segments, file)
        if page.name in HELP_PROSE_EXEMPT_FILES:
            continue
        if HELP_PROSE_EXEMPT_DIRS.intersection(rel_parts[1:-1]):
            continue
        rel = page.relative_to(root).as_posix()
        for line_number, line in enumerate(read(page).splitlines(), start=1):
            if VERSION_EXEMPT_RE.search(line):
                continue
            for match in HELP_INDEX_VERSION_RE.finditer(line):
                report.fail(
                    "help-prose-versions",
                    f"{rel}:{line_number}: version literal {match.group(0)} "
                    "(end-user help is versionless - describe the current "
                    "behaviour; release provenance belongs to the changelog, "
                    "#1767)",
                )


# mkdocs.yml's docs_dir is docs/help; the nav references the German
# variant (de/<slug>.md). mkdocs-static-i18n maps de->en, so the en/
# tree is an i18n mirror, not separately listed. We therefore check
# the de/ tree against the nav references.
NAV_REF_RE = re.compile(r"(de/[\w./-]+\.md)")


def check_mkdocs(report: Report) -> None:
    mkdocs = REPO / "mkdocs.yml"
    help_dir = REPO / "docs" / "help"
    if not mkdocs.exists():
        report.warn("mkdocs", "mkdocs.yml not found")
        return
    de_dir = help_dir / "de"
    if not de_dir.exists():
        report.warn("mkdocs", "docs/help/de not found")
        return

    referenced = set(NAV_REF_RE.findall(read(mkdocs)))
    actual = {f"de/{p.relative_to(de_dir).as_posix()}" for p in de_dir.rglob("*.md")}

    # Orphans: help pages on disk that no nav entry points to. They are
    # silently unreachable from the side nav (mkdocs --strict logs this
    # only at INFO and does NOT fail).
    orphans = sorted(actual - referenced)
    if orphans:
        report.fail(
            "mkdocs",
            f"{len(orphans)} help page(s) on disk but not in mkdocs.yml nav: "
            + ", ".join(orphans[:10])
            + (" ..." if len(orphans) > 10 else "")
            + " (add to docs/help/_meta.yaml + run make sync-mkdocs-nav)",
        )

    # Dead links: nav entries pointing at files that do not exist.
    dead = sorted(referenced - actual)
    if dead:
        report.fail(
            "mkdocs",
            f"{len(dead)} mkdocs.yml nav entr(y/ies) point to missing file(s): "
            + ", ".join(dead[:10])
            + (" ..." if len(dead) > 10 else ""),
        )


# ---------------------------------------------------------------------------
# Check: help docs coverage  (parity FAIL, route mapping WARN)
# ---------------------------------------------------------------------------

ROUTE_RE = re.compile(r'path="([^"]+)"')
# Routes that intentionally have no dedicated help page.
_ROUTE_NO_HELP = {"/", "*"}


def _help_slugs(lang: str) -> set[str]:
    base = REPO / "docs" / "help" / lang
    if not base.exists():
        return set()
    return {p.relative_to(base).with_suffix("").as_posix() for p in base.rglob("*.md")}


def check_help_coverage(report: Report) -> None:
    en = _help_slugs("en")
    de = _help_slugs("de")
    if not en and not de:
        report.warn("help-coverage", "no help pages found under docs/help/{en,de}")
        return

    # i18n parity: every help page must exist in both languages.
    only_en = sorted(en - de)
    only_de = sorted(de - en)
    if only_en:
        report.fail(
            "help-coverage",
            f"{len(only_en)} EN help page(s) with no DE counterpart: {', '.join(only_en[:8])}",
        )
    if only_de:
        report.fail(
            "help-coverage",
            f"{len(only_de)} DE help page(s) with no EN counterpart: {', '.join(only_de[:8])}",
        )

    # Route coverage (heuristic): every navigable route should be
    # describable from some help page. Many routes legitimately have
    # none, so this is a single advisory line, not a per-route FAIL.
    app = REPO / "frontend" / "src" / "App.tsx"
    if not app.exists():
        return
    slug_blob = " ".join(en | de)
    uncovered: list[str] = []
    for route in ROUTE_RE.findall(read(app)):
        if route in _ROUTE_NO_HELP:
            continue
        # The last static (non-param) segment is the route's identity.
        segments = [s for s in route.split("/") if s and not s.startswith(":")]
        if not segments:
            continue
        keyword = segments[-1]
        if keyword not in slug_blob:
            uncovered.append(route)
    if uncovered:
        report.warn(
            "help-coverage",
            "routes with no obvious help page (heuristic; some may not need one): "
            + ", ".join(sorted(set(uncovered))),
        )


# ---------------------------------------------------------------------------
# Check: i18n coverage  (WARN)
# ---------------------------------------------------------------------------


def _flatten_keys(obj, prefix: str = "") -> set[str]:
    keys: set[str] = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                keys |= _flatten_keys(value, path)
            else:
                keys.add(path)
    return keys


def check_i18n(report: Report, fix: bool) -> None:
    import json

    i18n_dir = REPO / "frontend" / "src" / "data" / "i18n"
    en_path = i18n_dir / "en.json"
    if not en_path.exists():
        report.warn("i18n", f"baseline catalog {en_path} not found")
        return

    if fix:
        _run_sync_i18n(report)

    en_keys = _flatten_keys(json.loads(read(en_path)))
    if not en_keys:
        report.warn("i18n", "en.json has no keys")
        return

    for path in sorted(i18n_dir.glob("*.json")):
        if path.name == "en.json":
            continue
        try:
            keys = _flatten_keys(json.loads(read(path)))
        except (ValueError, OSError) as exc:
            report.warn("i18n", f"{path.name}: could not parse ({exc})")
            continue
        missing = en_keys - keys
        if missing and len(missing) / len(en_keys) > 0.05:
            shown = sorted(missing)[:6]
            report.warn(
                "i18n",
                f"{path.name}: {len(missing)}/{len(en_keys)} keys missing vs en "
                f"({len(missing) / len(en_keys):.0%}): {', '.join(shown)} ...",
            )
    report.note(
        "i18n: backend-YAML <-> frontend-JSON sync drift is gated separately by frontend i18n-sync.test.ts (make test)"
    )


def _run_sync_i18n(report: Report) -> None:
    import subprocess

    script = REPO / "scripts" / "sync_i18n_to_frontend.py"
    if not script.exists():
        return
    try:
        result = subprocess.run(
            ["python3", str(script)],
            cwd=REPO,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            report.warn(
                "i18n",
                "ran sync_i18n_to_frontend.py to refresh frontend JSON from backend YAML (auto-fixed)",
                fixed=True,
            )
        else:
            report.warn(
                "i18n",
                f"sync_i18n_to_frontend.py exited {result.returncode}: {result.stderr.strip()[:200]}",
            )
    except (OSError, subprocess.SubprocessError) as exc:
        report.warn("i18n", f"could not run sync_i18n_to_frontend.py: {exc}")


# ---------------------------------------------------------------------------
# Registry + runner
# ---------------------------------------------------------------------------

CHECKS = {
    "version": lambda r, o: check_version(r, o.fix),
    "plugins": lambda r, o: check_plugins(r, o.fix),
    "test-counts": lambda r, o: check_test_counts(r, o.fix, o.test_counts),
    "feature-completeness": lambda r, o: check_feature_completeness(r),
    "stale-dates": lambda r, o: check_stale_dates(r),
    "themes": lambda r, o: check_themes(r),
    "mkdocs": lambda r, o: check_mkdocs(r),
    "help-index-versions": lambda r, o: check_help_index_versions(r),
    "help-prose-versions": lambda r, o: check_help_prose_versions(r),
    "help-coverage": lambda r, o: check_help_coverage(r),
    "i18n": lambda r, o: check_i18n(r, o.fix),
}


def run(selected: list[str], opts) -> Report:
    report = Report()
    for name in selected:
        try:
            CHECKS[name](report, opts)
        except Exception as exc:  # a broken check must not mask the rest
            report.fail(name, f"check raised {type(exc).__name__}: {exc}")
    return report


def print_report(report: Report, selected: list[str]) -> None:
    print("Documentation verification")
    print("=" * 60)
    print(f"canonical version : v{canonical_version()}")
    print(f"plugin dirs       : {plugin_count()}")
    print(f"checks run        : {', '.join(selected)}")
    print()

    if not report.findings:
        print("OK -- no drift found.")
    else:
        for f in report.findings:
            tag = "FIXED" if f.fixed else f.severity
            print(f"[{tag:5}] {f.check}: {f.message}")

    for note in report.notes:
        print(f"  note: {note}")

    print()
    print(
        f"summary: {report.fail_count} FAIL, {report.warn_count} WARN"
        + (f", {report.fixed_count} auto-fixed" if report.fixed_count else "")
    )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Verify Adaptive Learner documentation for drift.")
    parser.add_argument(
        "--check",
        help="comma-separated subset of checks to run (default: all)",
    )
    parser.add_argument("--list", action="store_true", help="list registered checks and exit")
    parser.add_argument(
        "--fix", action="store_true", help="best-effort auto-fix of mechanical drift"
    )
    parser.add_argument(
        "--test-counts",
        dest="test_counts",
        action="store_true",
        help="also collect real pytest/vitest counts (slow)",
    )
    opts = parser.parse_args(argv)

    if opts.list:
        for name in CHECKS:
            print(name)
        return 0

    if opts.check:
        selected = [c.strip() for c in opts.check.split(",") if c.strip()]
        unknown = [c for c in selected if c not in CHECKS]
        if unknown:
            parser.error(f"unknown check(s): {', '.join(unknown)}. Known: {', '.join(CHECKS)}")
    else:
        selected = list(CHECKS)

    try:
        report = run(selected, opts)
    except Exception as exc:  # canonical source unreadable etc.
        print(f"verifier could not run: {exc}", file=sys.stderr)
        return 2

    print_report(report, selected)
    return 1 if report.fail_count else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
