#!/usr/bin/env python3
"""Theme/design-token gate for Adaptive Learner.

Stdlib only (json, re, pathlib, argparse, math). No pip deps -- this
script must run with a bare ``python3`` in CI before any project venv or
node toolchain exists. It is the CLI counterpart to the three Vitest
guards (``themes.test.ts`` token parity, ``contrast.test.ts`` WCAG AA,
``no-hardcoded-colors.test.ts`` literal scan): it re-checks the
token MATRIX directly from ``styles/themes/theme-*.css`` so a theme gate
exists even where node/vitest cannot run, and adds an
undefined-``var(--token)``-reference check the Vitest suite does not do.

axe-core only checks the rendered DOM; this checks the tokens themselves.

Checks (each emits stable violation keys so the baseline can pin them):

  token-completeness  Every theme defines the EXACT reference (light)
                      token set -- no theme may omit a token and rely on
                      a light-fallthrough.
  undefined-refs      Every ``var(--name)`` in any CSS file references a
                      token defined somewhere in the CSS layer.
  contrast            WCAG 2.1 AA across ALL theme variants for the text
                      /background pairs the UI actually renders.
  semantic-contrast   Status tints (success/warning/error/info on their
                      ``-bg`` surfaces) stay legible across all variants.

Baseline ratchet:
  Pre-existing violations are recorded in ``.theme-baseline.json`` and
  treated as known debt -- only NEW violations (not in the baseline)
  fail ``--enforce``. The baseline only shrinks: ``--update-baseline``
  refuses to ADD keys unless ``--allow-baseline-growth`` is passed.

Exit codes:
  0  clean (no NEW violations under --enforce; or report-only mode)
  1  NEW violations found under --enforce
  2  the gate itself could not run (missing theme dir / parse error)

Usage:
  python3 scripts/verify_theme.py                 # report, exit 0
  python3 scripts/verify_theme.py --enforce       # gate, exit 1 on NEW
  python3 scripts/verify_theme.py --check contrast,undefined-refs
  python3 scripts/verify_theme.py --list
  python3 scripts/verify_theme.py --quiet --enforce
  python3 scripts/verify_theme.py --update-baseline
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
STYLES = REPO / "frontend" / "src" / "styles"
THEMES_DIR = STYLES / "themes"
BASELINE_PATH = REPO / ".theme-baseline.json"

# The reference theme: every other theme is diffed against its token set.
REFERENCE_THEME = "light"

# WCAG 2.1 AA thresholds (SC 1.4.3 normal text / SC 1.4.11 large text + UI).
AA_NORMAL_TEXT = 4.5
AA_LARGE_TEXT_OR_UI = 3.0


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Violation:
    """A single token/contrast finding, keyed stably for the baseline."""

    check: str
    key: str
    message: str


@dataclass
class Report:
    violations: list[Violation] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def add(self, check: str, key: str, message: str) -> None:
        self.violations.append(Violation(check, key, message))

    def error(self, message: str) -> None:
        self.errors.append(message)


# ---------------------------------------------------------------------------
# WCAG contrast (relative-luminance formula, WCAG 2.1)
# ---------------------------------------------------------------------------


def parse_hex(value: str) -> tuple[int, int, int]:
    """Parse a 3- or 6-digit hex color into 8-bit (r, g, b)."""
    hex_str = value.strip().lstrip("#")
    if len(hex_str) == 3:
        hex_str = "".join(ch * 2 for ch in hex_str)
    if len(hex_str) < 6:
        raise ValueError(f"invalid hex color: {value}")
    return (
        int(hex_str[0:2], 16),
        int(hex_str[2:4], 16),
        int(hex_str[4:6], 16),
    )


def _srgb_to_linear(channel_8bit: int) -> float:
    c = channel_8bit / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def relative_luminance(rgb: tuple[int, int, int]) -> float:
    r, g, b = (_srgb_to_linear(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    la = relative_luminance(a)
    lb = relative_luminance(b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)


def mix_srgb(
    a: tuple[int, int, int], b: tuple[int, int, int], frac: float
) -> tuple[int, int, int]:
    """Replicate CSS ``color-mix(in srgb, A frac%, B)``.

    A per-channel linear blend in gamma-encoded sRGB, matching how the
    browser computes the matching-feedback tints in ``global.css``.
    """
    return tuple(round(a[i] * frac + b[i] * (1 - frac)) for i in range(3))  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# CSS parsing
# ---------------------------------------------------------------------------

_DEF_RE = re.compile(r"--([a-z0-9-]+)\s*:")
_HEX_DEF_RE = re.compile(r"--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b")
# A FALLBACK-LESS reference: ``var(--name)`` with nothing before the closing
# paren. ``var(--name, <fallback>)`` is intentional defaulting (a runtime-set
# inline custom property, or a defensive default that resolves to the
# fallback) and is NOT a bug, so it is deliberately excluded.
_VAR_REF_RE = re.compile(r"var\(\s*--([a-z0-9-]+)\s*\)")


def _strip_css_comments(css: str) -> str:
    return re.sub(r"/\*[\s\S]*?\*/", "", css)


def declared_tokens(css: str) -> set[str]:
    """All ``--name:`` declarations in a stylesheet (any value form)."""
    return {m.group(1) for m in _DEF_RE.finditer(_strip_css_comments(css))}


def hex_tokens(css: str) -> dict[str, str]:
    """``--name: #hex`` declarations only (for contrast computation)."""
    out: dict[str, str] = {}
    for m in _HEX_DEF_RE.finditer(_strip_css_comments(css)):
        out[m.group(1)] = m.group(2)
    return out


def referenced_tokens(css: str) -> set[str]:
    """Tokens used via a fallback-less ``var(--name)`` in a stylesheet.

    Only fallback-less references are returned -- those are the ones that
    render nothing when the token is undefined. ``var(--name, fallback)``
    resolves to its fallback and is intentional.
    """
    return {m.group(1) for m in _VAR_REF_RE.finditer(_strip_css_comments(css))}


def theme_files() -> list[Path]:
    return sorted(THEMES_DIR.glob("theme-*.css"))


def theme_id(path: Path) -> str:
    return path.name[len("theme-") : -len(".css")]


def all_css_files() -> list[Path]:
    return sorted(STYLES.rglob("*.css"))


# ---------------------------------------------------------------------------
# Contrast pair model
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Pair:
    """A text/background contrast requirement, named for the baseline key."""

    name: str
    fg: str
    bg: str
    minimum: float


# The pairs the UI actually renders, mirroring contrast.test.ts. Each entry
# is checked against EVERY theme's hex tokens.
CONTRAST_PAIRS: list[Pair] = [
    Pair("body-on-primary", "fg-primary", "bg-primary", AA_NORMAL_TEXT),
    Pair("body-on-surface", "fg-primary", "bg-surface", AA_NORMAL_TEXT),
    Pair("body-on-elevated", "fg-primary", "bg-elevated", AA_NORMAL_TEXT),
    Pair("secondary-on-primary", "fg-secondary", "bg-primary", AA_NORMAL_TEXT),
    Pair("muted-on-primary", "fg-muted", "bg-primary", AA_NORMAL_TEXT),
    Pair("secondary-on-surface", "fg-secondary", "bg-surface", AA_NORMAL_TEXT),
    Pair("secondary-on-elevated", "fg-secondary", "bg-elevated", AA_NORMAL_TEXT),
    Pair("accent-button", "accent-fg", "accent", AA_NORMAL_TEXT),
    # shadcn button variants (#179): every variant's (bg, fg) pair.
    Pair("btn-secondary", "fg-primary", "bg-secondary", AA_NORMAL_TEXT),
    Pair("btn-outline-ghost", "fg-primary", "bg-primary", AA_NORMAL_TEXT),
    Pair("btn-destructive", "fg-inverse", "error", AA_NORMAL_TEXT),
    # Status colors as text on the page.
    Pair("status-success", "success", "bg-primary", AA_NORMAL_TEXT),
    Pair("status-error", "error", "bg-primary", AA_NORMAL_TEXT),
    Pair("status-warning", "warning", "bg-primary", AA_NORMAL_TEXT),
    Pair("status-info", "info", "bg-primary", AA_NORMAL_TEXT),
    # Exercise feedback colors (large-text/UI threshold).
    Pair("exercise-correct", "exercise-correct", "bg-surface", AA_LARGE_TEXT_OR_UI),
    Pair("exercise-wrong", "exercise-wrong", "bg-surface", AA_LARGE_TEXT_OR_UI),
    # --accent used as TEXT (#96) — ghost hint / reveal links.
    Pair("accent-text-on-primary", "accent-text", "bg-primary", AA_NORMAL_TEXT),
    Pair("accent-text-on-surface", "accent-text", "bg-surface", AA_NORMAL_TEXT),
    Pair("accent-text-on-elevated", "accent-text", "bg-elevated", AA_LARGE_TEXT_OR_UI),
]


@dataclass(frozen=True)
class MixPair:
    """fg over a ``color-mix(in srgb, src frac%, surface)`` tint (#108/#183)."""

    name: str
    fg: str
    src: str
    surface: str
    frac: float
    minimum: float


# Matching exercise tinted tiles — the surface is mixed from a status/exercise
# color, fg-primary renders on top. Mirrors the global.css color-mix tokens.
MIX_PAIRS: list[MixPair] = [
    MixPair("matching-correct-bg", "fg-primary", "exercise-correct", "bg-surface", 0.22, AA_NORMAL_TEXT),
    MixPair("matching-error-bg", "fg-primary", "exercise-wrong", "bg-surface", 0.22, AA_NORMAL_TEXT),
    MixPair("matching-side-a", "fg-primary", "info", "bg-surface", 0.16, AA_NORMAL_TEXT),
    MixPair("matching-side-b", "fg-primary", "success", "bg-surface", 0.16, AA_NORMAL_TEXT),
    MixPair("matching-paired", "fg-primary", "exercise-matched", "bg-surface", 0.22, AA_NORMAL_TEXT),
]

# Semantic status badges: the status color rendered as text on its own tinted
# ``-bg`` surface (e.g. a success badge). Large-text/UI threshold because badge
# text is typically short and emphasised.
SEMANTIC_PAIRS: list[Pair] = [
    Pair("badge-success", "success", "success-bg", AA_LARGE_TEXT_OR_UI),
    Pair("badge-error", "error", "error-bg", AA_LARGE_TEXT_OR_UI),
    Pair("badge-warning", "warning", "warning-bg", AA_LARGE_TEXT_OR_UI),
    Pair("badge-info", "info", "info-bg", AA_LARGE_TEXT_OR_UI),
]


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------


def check_token_completeness(report: Report) -> None:
    """Every theme defines exactly the reference (light) token set."""
    files = theme_files()
    ref_path = THEMES_DIR / f"theme-{REFERENCE_THEME}.css"
    if not ref_path.exists():
        report.error(f"reference theme missing: {ref_path}")
        return
    reference = declared_tokens(ref_path.read_text(encoding="utf-8"))
    for path in files:
        tid = theme_id(path)
        if tid == REFERENCE_THEME:
            continue
        tokens = declared_tokens(path.read_text(encoding="utf-8"))
        for missing in sorted(reference - tokens):
            report.add(
                "token-completeness",
                f"{tid}:missing:{missing}",
                f"theme '{tid}' is missing token --{missing} (defined in {REFERENCE_THEME})",
            )
        for extra in sorted(tokens - reference):
            report.add(
                "token-completeness",
                f"{tid}:extra:{extra}",
                f"theme '{tid}' defines --{extra}, not present in {REFERENCE_THEME}",
            )


def check_undefined_refs(report: Report) -> None:
    """Every ``var(--name)`` resolves to a token defined in the CSS layer."""
    css_files = all_css_files()
    defined: set[str] = set()
    for path in css_files:
        defined |= declared_tokens(path.read_text(encoding="utf-8"))
    for path in css_files:
        rel = path.relative_to(REPO).as_posix()
        css = path.read_text(encoding="utf-8")
        for name in sorted(referenced_tokens(css)):
            # ``--color-*`` are the Tailwind @theme bridge aliases; they are
            # consumed by generated utility classes, not by other CSS, so a
            # var(--color-x) reference is never expected. Defined-set covers
            # them anyway.
            if name not in defined:
                report.add(
                    "undefined-refs",
                    f"{rel}:{name}",
                    f"{rel} references var(--{name}) but no CSS file defines --{name}",
                )


def _contrast_for_theme(tid: str, tokens: dict[str, str], report: Report) -> None:
    def rgb(name: str) -> tuple[int, int, int] | None:
        value = tokens.get(name)
        if value is None:
            return None
        try:
            return parse_hex(value)
        except ValueError:
            return None

    for pair in CONTRAST_PAIRS:
        fg = rgb(pair.fg)
        bg = rgb(pair.bg)
        if fg is None or bg is None:
            # A non-hex (rgba) or absent token: completeness/parse checks own
            # this; skip the contrast computation rather than crash.
            continue
        ratio = contrast_ratio(fg, bg)
        if ratio < pair.minimum:
            report.add(
                "contrast",
                f"{tid}:{pair.name}",
                f"theme '{tid}' {pair.name}: --{pair.fg} on --{pair.bg} "
                f"= {ratio:.2f}:1 (needs >= {pair.minimum})",
            )

    for mix in MIX_PAIRS:
        fg = rgb(mix.fg)
        src = rgb(mix.src)
        surface = rgb(mix.surface)
        if fg is None or src is None or surface is None:
            continue
        tint = mix_srgb(src, surface, mix.frac)
        ratio = contrast_ratio(fg, tint)
        if ratio < mix.minimum:
            report.add(
                "contrast",
                f"{tid}:{mix.name}",
                f"theme '{tid}' {mix.name}: --{mix.fg} on color-mix("
                f"--{mix.src} {mix.frac:.0%}, --{mix.surface}) "
                f"= {ratio:.2f}:1 (needs >= {mix.minimum})",
            )


def check_contrast(report: Report) -> None:
    """WCAG AA across every theme for the rendered text/background pairs."""
    for path in theme_files():
        tid = theme_id(path)
        tokens = hex_tokens(path.read_text(encoding="utf-8"))
        _contrast_for_theme(tid, tokens, report)


def check_semantic_contrast(report: Report) -> None:
    """Status badge tints (color on its ``-bg`` surface) across all themes."""
    for path in theme_files():
        tid = theme_id(path)
        tokens = hex_tokens(path.read_text(encoding="utf-8"))
        for pair in SEMANTIC_PAIRS:
            fg = tokens.get(pair.fg)
            bg = tokens.get(pair.bg)
            if fg is None or bg is None:
                continue
            try:
                ratio = contrast_ratio(parse_hex(fg), parse_hex(bg))
            except ValueError:
                continue
            if ratio < pair.minimum:
                report.add(
                    "semantic-contrast",
                    f"{tid}:{pair.name}",
                    f"theme '{tid}' {pair.name}: --{pair.fg} on --{pair.bg} "
                    f"= {ratio:.2f}:1 (needs >= {pair.minimum})",
                )


CHECKS: dict[str, tuple[str, Callable[[Report], None]]] = {
    "token-completeness": ("Every theme defines the reference token set", check_token_completeness),
    "undefined-refs": ("No var(--token) reference resolves to nothing", check_undefined_refs),
    "contrast": ("WCAG AA across all themes for rendered pairs", check_contrast),
    "semantic-contrast": ("Status badge tints stay legible across themes", check_semantic_contrast),
}


# ---------------------------------------------------------------------------
# Baseline
# ---------------------------------------------------------------------------


def load_baseline() -> dict[str, list[str]]:
    if not BASELINE_PATH.exists():
        return {}
    try:
        data = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"verify-theme: corrupt baseline {BASELINE_PATH}: {exc}", file=sys.stderr)
        return {}
    return {k: list(v) for k, v in data.get("violations", {}).items()}


def baseline_keys(baseline: dict[str, list[str]], check: str) -> set[str]:
    return set(baseline.get(check, []))


def write_baseline(report: Report, previous: dict[str, list[str]], allow_growth: bool) -> int:
    grouped: dict[str, list[str]] = {}
    for violation in report.violations:
        grouped.setdefault(violation.check, []).append(violation.key)
    grouped = {check: sorted(set(keys)) for check, keys in sorted(grouped.items())}

    if not allow_growth:
        for check, keys in grouped.items():
            new_keys = set(keys) - baseline_keys(previous, check)
            if new_keys:
                print(
                    f"verify-theme: refusing to grow the baseline for '{check}' "
                    f"(+{len(new_keys)} new). Fix the violation, or pass "
                    f"--allow-baseline-growth to record it as known debt:",
                    file=sys.stderr,
                )
                for key in sorted(new_keys):
                    print(f"    {key}", file=sys.stderr)
                return 1

    payload = {
        "_comment": (
            "Baseline of known theme/token violations for scripts/verify_theme.py. "
            "Ratchet: only NEW violations fail --enforce. Prune entries as they are "
            "fixed; do not add by hand."
        ),
        "violations": grouped,
    }
    BASELINE_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    total = sum(len(v) for v in grouped.values())
    print(f"verify-theme: wrote baseline with {total} known violation(s) -> {BASELINE_PATH.name}")
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def run_checks(selected: list[str]) -> Report:
    report = Report()
    for name in selected:
        CHECKS[name][1](report)
    return report


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="verify_theme.py",
        description="Theme/design-token gate (token matrix + WCAG contrast).",
    )
    parser.add_argument(
        "--check",
        help="comma-separated subset of checks to run (default: all)",
    )
    parser.add_argument("--list", action="store_true", help="list registered checks and exit")
    parser.add_argument(
        "--enforce",
        action="store_true",
        help="exit 1 on any NEW violation vs the baseline",
    )
    parser.add_argument("--quiet", action="store_true", help="only print on failure")
    parser.add_argument(
        "--update-baseline",
        action="store_true",
        help="record current violations as the baseline (only shrinks unless --allow-baseline-growth)",
    )
    parser.add_argument(
        "--allow-baseline-growth",
        action="store_true",
        help="permit --update-baseline to ADD new known-debt entries",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    if args.list:
        for name, (desc, _fn) in CHECKS.items():
            print(f"  {name:<20} {desc}")
        return 0

    if not THEMES_DIR.is_dir():
        print(f"verify-theme: theme directory not found: {THEMES_DIR}", file=sys.stderr)
        return 2

    if args.check:
        selected = [c.strip() for c in args.check.split(",") if c.strip()]
        unknown = [c for c in selected if c not in CHECKS]
        if unknown:
            print(f"verify-theme: unknown check(s): {', '.join(unknown)}", file=sys.stderr)
            return 2
    else:
        selected = list(CHECKS)

    report = run_checks(selected)

    if report.errors:
        for message in report.errors:
            print(f"verify-theme: ERROR {message}", file=sys.stderr)
        return 2

    if args.update_baseline:
        return write_baseline(report, load_baseline(), args.allow_baseline_growth)

    baseline = load_baseline()
    new_violations: list[Violation] = []
    known_count = 0
    for violation in report.violations:
        if violation.key in baseline_keys(baseline, violation.check):
            known_count += 1
        else:
            new_violations.append(violation)

    if not args.quiet:
        themes = len(theme_files())
        print(f"verify-theme: {themes} themes, checks: {', '.join(selected)}")
        if known_count:
            print(f"verify-theme: {known_count} known (baseline) violation(s) — see {BASELINE_PATH.name}")
        if not report.violations:
            print("verify-theme: OK — no violations")

    if new_violations:
        label = "NEW violation(s)" if baseline else "violation(s)"
        print(f"verify-theme: {len(new_violations)} {label}:", file=sys.stderr)
        for violation in new_violations:
            print(f"  [{violation.check}] {violation.message}", file=sys.stderr)
        if args.enforce:
            return 1
        print(
            "verify-theme: report-only (pass --enforce to fail the build).",
            file=sys.stderr,
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
