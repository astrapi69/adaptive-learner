"""Unit tests for ``scripts/verify_theme.py`` (the theme/token gate).

The script is repo-level tooling (stdlib only, no ``app.*`` imports), but
``make test-backend`` is the only python test runner wired into ``make
test`` -- so its tests live here to stay in the green-baseline gate.

Coverage: the WCAG contrast math, the CSS parsers (incl. the
fallback-less ``var()`` rule), each check against synthesised fixtures
(good set -> pass; missing token -> fail; sub-threshold contrast -> fail;
above-threshold -> pass), and an integration assertion that the REAL
repo themes pass the gate clean.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
_SCRIPT = REPO / "scripts" / "verify_theme.py"

_spec = importlib.util.spec_from_file_location("verify_theme", _SCRIPT)
assert _spec and _spec.loader
vt = importlib.util.module_from_spec(_spec)
# Register before exec: dataclasses resolves string field annotations via
# ``sys.modules[cls.__module__]``, which is absent for an importlib-loaded
# module otherwise (AttributeError on the frozen @dataclass).
sys.modules["verify_theme"] = vt
_spec.loader.exec_module(vt)


# --------------------------------------------------------------------------
# WCAG contrast math
# --------------------------------------------------------------------------


def test_parse_hex_three_and_six_digit() -> None:
    assert vt.parse_hex("#fff") == (255, 255, 255)
    assert vt.parse_hex("000000") == (0, 0, 0)
    assert vt.parse_hex("#4f46e5") == (0x4F, 0x46, 0xE5)


def test_parse_hex_rejects_invalid() -> None:
    with pytest.raises(ValueError):
        vt.parse_hex("rgba(0,0,0,0.5)")


def test_contrast_black_on_white_is_wcag_ceiling() -> None:
    assert vt.contrast_ratio((0, 0, 0), (255, 255, 255)) == pytest.approx(21.0, abs=0.01)


def test_contrast_argument_order_irrelevant() -> None:
    a = vt.contrast_ratio((26, 26, 26), (255, 255, 255))
    b = vt.contrast_ratio((255, 255, 255), (26, 26, 26))
    assert a == pytest.approx(b, abs=1e-9)


def test_contrast_identical_colors_is_one() -> None:
    assert vt.contrast_ratio((255, 255, 255), (255, 255, 255)) == pytest.approx(1.0)


def test_mix_srgb_endpoints_and_midpoint() -> None:
    black, white = (0, 0, 0), (255, 255, 255)
    assert vt.mix_srgb(white, black, 1.0) == (255, 255, 255)
    assert vt.mix_srgb(white, black, 0.0) == (0, 0, 0)
    assert vt.mix_srgb(white, black, 0.5) == (128, 128, 128)


# --------------------------------------------------------------------------
# CSS parsers
# --------------------------------------------------------------------------


def test_declared_tokens_collects_all_definitions() -> None:
    css = ":root { --a: #fff; --b-c: 12px; /* --d: x */ }"
    assert vt.declared_tokens(css) == {"a", "b-c"}


def test_hex_tokens_only_hex_values() -> None:
    css = ":root { --a: #fff; --b: rgba(0,0,0,.4); --c: #123456; }"
    assert vt.hex_tokens(css) == {"a": "#fff", "c": "#123456"}


def test_referenced_tokens_excludes_fallback_references() -> None:
    css = "x{ color: var(--bare); background: var(--withfb, #fff); }"
    # Only the fallback-LESS reference is flagged; var(--withfb, #fff)
    # resolves to its fallback and is intentional.
    assert vt.referenced_tokens(css) == {"bare"}


def test_referenced_tokens_inner_bare_var_in_fallback() -> None:
    # var(--outer, var(--inner)): outer has a fallback (skip), inner is bare.
    css = "x{ background: var(--outer, var(--inner)); }"
    assert vt.referenced_tokens(css) == {"inner"}


# --------------------------------------------------------------------------
# Check functions against synthesised fixtures
# --------------------------------------------------------------------------


def _write_theme(themes_dir: Path, theme: str, tokens: dict[str, str]) -> None:
    body = "\n".join(f"  --{name}: {value};" for name, value in tokens.items())
    css = f':root,\n[data-theme="{theme}"] {{\n{body}\n}}\n'
    (themes_dir / f"theme-{theme}.css").write_text(css, encoding="utf-8")


@pytest.fixture()
def styles_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A throwaway styles dir wired into the script's module globals."""
    styles = tmp_path / "styles"
    themes = styles / "themes"
    themes.mkdir(parents=True)
    monkeypatch.setattr(vt, "STYLES", styles)
    monkeypatch.setattr(vt, "THEMES_DIR", themes)
    monkeypatch.setattr(vt, "REPO", tmp_path)
    return styles


def test_token_completeness_pass(styles_root: Path) -> None:
    themes = styles_root / "themes"
    ref = {"bg-primary": "#fff", "fg-primary": "#000", "accent": "#4f46e5"}
    _write_theme(themes, "light", ref)
    _write_theme(themes, "dark", {"bg-primary": "#000", "fg-primary": "#fff", "accent": "#818cf8"})
    report = vt.Report()
    vt.check_token_completeness(report)
    assert report.violations == []


def test_token_completeness_missing_token_fails(styles_root: Path) -> None:
    themes = styles_root / "themes"
    _write_theme(themes, "light", {"bg-primary": "#fff", "fg-primary": "#000", "accent": "#4f46e5"})
    _write_theme(themes, "dark", {"bg-primary": "#000", "fg-primary": "#fff"})  # no --accent
    report = vt.Report()
    vt.check_token_completeness(report)
    keys = {v.key for v in report.violations}
    assert "dark:missing:accent" in keys


def test_token_completeness_extra_token_fails(styles_root: Path) -> None:
    themes = styles_root / "themes"
    _write_theme(themes, "light", {"bg-primary": "#fff"})
    _write_theme(themes, "dark", {"bg-primary": "#000", "rogue": "#f00"})
    report = vt.Report()
    vt.check_token_completeness(report)
    keys = {v.key for v in report.violations}
    assert "dark:extra:rogue" in keys


def test_contrast_below_threshold_fails(styles_root: Path) -> None:
    themes = styles_root / "themes"
    # fg-primary == bg-primary -> 1:1, far below AA.
    _write_theme(themes, "light", {"fg-primary": "#ffffff", "bg-primary": "#ffffff"})
    report = vt.Report()
    vt.check_contrast(report)
    keys = {v.key for v in report.violations}
    assert "light:body-on-primary" in keys


def test_contrast_above_threshold_passes(styles_root: Path) -> None:
    themes = styles_root / "themes"
    _write_theme(themes, "light", {"fg-primary": "#000000", "bg-primary": "#ffffff"})
    report = vt.Report()
    vt.check_contrast(report)
    keys = {v.key for v in report.violations}
    assert "light:body-on-primary" not in keys


def test_semantic_contrast_below_threshold_fails(styles_root: Path) -> None:
    themes = styles_root / "themes"
    # success text nearly identical to its badge tint -> below the 3:1 UI bar.
    _write_theme(themes, "light", {"success": "#dddddd", "success-bg": "#ffffff"})
    report = vt.Report()
    vt.check_semantic_contrast(report)
    keys = {v.key for v in report.violations}
    assert "light:badge-success" in keys


def test_undefined_ref_without_fallback_fails(styles_root: Path) -> None:
    (styles_root / "themes" / "theme-light.css").write_text(
        ":root { --defined: #fff; }", encoding="utf-8"
    )
    (styles_root / "global.css").write_text(
        "x { color: var(--missing); }", encoding="utf-8"
    )
    report = vt.Report()
    vt.check_undefined_refs(report)
    assert any(v.key.endswith(":missing") for v in report.violations)


def test_undefined_ref_with_fallback_passes(styles_root: Path) -> None:
    (styles_root / "themes" / "theme-light.css").write_text(
        ":root { --defined: #fff; }", encoding="utf-8"
    )
    (styles_root / "global.css").write_text(
        "x { color: var(--missing, var(--defined)); }", encoding="utf-8"
    )
    report = vt.Report()
    vt.check_undefined_refs(report)
    assert report.violations == []


# --------------------------------------------------------------------------
# Integration: the real repo themes pass the gate clean
# --------------------------------------------------------------------------


def test_real_repo_themes_pass_all_checks() -> None:
    report = vt.run_checks(list(vt.CHECKS))
    assert report.errors == [], report.errors
    messages = [v.message for v in report.violations]
    assert messages == [], "real themes regressed:\n" + "\n".join(messages)


def test_main_enforce_exits_zero_on_clean_repo() -> None:
    assert vt.main(["--enforce", "--quiet"]) == 0


def test_main_list_and_unknown_check() -> None:
    assert vt.main(["--list"]) == 0
    assert vt.main(["--check", "does-not-exist"]) == 2
