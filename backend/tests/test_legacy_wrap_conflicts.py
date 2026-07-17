"""Golden tests for scripts/check-legacy-wrap-conflicts.py (EXP-044, #1592).

The pre-wrap conflict audit gained a legacy-vs-unlayered-legacy precedence
check after the #1592 blind spot: wrapping ``LessonMode-LandscapeNav`` into
``@layer legacy`` flipped ``.app-nav.is-lesson-compact .nav-links
{display:none}`` below the still-unlayered base ``.nav-links {display:flex}``
(an unlayered rule always beats a layered one), un-collapsing the lesson nav.
The utility oracle never saw it because the winning rule is legacy, not a
Tailwind utility - only the visual gate caught it.

These tests pin the new detection (the #1592 pattern must be flagged as a
dependency, not CLEAN) and guard the existing utility-conflict path (the
#1571 ``.nav-group-label`` case) against regression. They are pure - no
built dist oracle, no TSX scan - so they run in the ordinary backend suite.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPTS = _REPO_ROOT / "scripts"


def _load(filename: str):
    path = _SCRIPTS / filename
    module_name = filename.removesuffix(".py").replace("-", "_")
    spec = importlib.util.spec_from_file_location(module_name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def audit():
    return _load("check-legacy-wrap-conflicts.py")


@pytest.fixture(scope="module")
def cpl():
    return _load("css_parse_lib.py")


def _split(rules, needle):
    """Partition parsed rules into (block-with-needle, other) by selector."""
    block = [r for r in rules if needle in r.selector]
    other = [r for r in rules if needle not in r.selector]
    return block, other


# --------------------------------------------------------------------------
# selector_specificity
# --------------------------------------------------------------------------


def test_specificity_counts_classes_ids_elements(audit):
    assert audit.cpl.selector_specificity(".nav-links") == (0, 1, 0)
    assert audit.cpl.selector_specificity(".app-nav.is-lesson-compact .nav-links") == (0, 3, 0)
    assert audit.cpl.selector_specificity("#main .card a") == (1, 1, 1)
    assert audit.cpl.selector_specificity("a") == (0, 0, 1)
    assert audit.cpl.selector_specificity(".btn:hover") == (0, 2, 0)


# --------------------------------------------------------------------------
# find_legacy_dependencies - the #1592 golden case
# --------------------------------------------------------------------------


def test_lessonmode_dependency_is_flagged(audit, cpl):
    """RED before #1592, GREEN after: the exact LessonMode/nav-links flip.

    ``.app-nav.is-lesson-compact .nav-links {display:none}`` (higher
    specificity, currently wins) depends on beating the unlayered base
    ``.nav-links {display:flex}``. Wrapped it loses -> must be flagged.
    """
    css = (
        ".nav-links { display: flex; }\n.app-nav.is-lesson-compact .nav-links { display: none; }\n"
    )
    rules = cpl.parse_css(css)
    block, other = _split(rules, "is-lesson-compact")
    deps = audit.find_legacy_dependencies(block, other)
    assert len(deps) == 1
    dep = deps[0]
    assert dep.block_prop == "display"
    assert "nav-links" in dep.other_part
    assert dep.block_spec >= dep.other_spec


def test_lower_specificity_block_not_flagged(audit, cpl):
    """No flip when the block rule already LOSES: the unlayered rule wins
    today and keeps winning after wrapping."""
    css = (
        ".nav-links { display: flex; }\n.app-nav.is-lesson-compact .nav-links { display: none; }\n"
    )
    rules = cpl.parse_css(css)
    block, other = _split(rules, "is-lesson-compact")
    # Swap roles: the LESS specific base rule is the block; the more
    # specific unlayered rule already wins -> no dependency.
    assert audit.find_legacy_dependencies(other, block) == []


def test_same_value_not_flagged(audit, cpl):
    """wertgleich overlap (identical prop+value) is harmless, not a flip."""
    css = (
        ".nav-links { display: flex; }\n.app-nav.is-lesson-compact .nav-links { display: flex; }\n"
    )
    rules = cpl.parse_css(css)
    block, other = _split(rules, "is-lesson-compact")
    assert audit.find_legacy_dependencies(block, other) == []


def test_disjoint_properties_not_flagged(audit, cpl):
    """Same element, different (non-overlapping) properties -> no flip."""
    css = ".nav-links { color: red; }\n.app-nav.is-lesson-compact .nav-links { display: none; }\n"
    rules = cpl.parse_css(css)
    block, other = _split(rules, "is-lesson-compact")
    assert audit.find_legacy_dependencies(block, other) == []


def test_different_subject_classes_not_flagged(audit, cpl):
    """Different subject elements never collide."""
    css = ".sidebar { display: flex; }\n.app-nav.is-lesson-compact .nav-links { display: none; }\n"
    rules = cpl.parse_css(css)
    block, other = _split(rules, "is-lesson-compact")
    assert audit.find_legacy_dependencies(block, other) == []


def test_disjoint_ancestor_contexts_not_flagged(audit, cpl):
    """Same rightmost class, mutually-exclusive ancestor contexts -> never
    the same element -> not a flip (the @4563 PWA-banner false positive).

    ``.install-prompt-actions .btn`` and ``.lesson-next-step-card .btn``
    both end in ``.btn`` but no ``.btn`` is under both ancestors.
    """
    css = (
        ".lesson-next-step-card .btn { flex: 0 0 auto; }\n"
        ".install-prompt-actions .btn { flex: 1; }\n"
    )
    rules = cpl.parse_css(css)
    block, other = _split(rules, "install-prompt-actions")
    assert audit.find_legacy_dependencies(block, other) == []


def test_bare_base_rule_matches_any_context(audit, cpl):
    """A bare unlayered base rule (no ancestor context) DOES collide with a
    contextual block override on the same element - the #1592 shape."""
    css = (
        ".nav-links { display: flex; }\n.app-nav.is-lesson-compact .nav-links { display: none; }\n"
    )
    rules = cpl.parse_css(css)
    block, other = _split(rules, "is-lesson-compact")
    assert len(audit.find_legacy_dependencies(block, other)) == 1


def test_important_unlayered_rule_not_flagged(audit, cpl):
    """An !important unlayered rule already wins regardless of layer, so
    wrapping introduces no NEW flip."""
    css = (
        ".nav-links { display: flex !important; }\n"
        ".app-nav.is-lesson-compact .nav-links { display: none; }\n"
    )
    rules = cpl.parse_css(css)
    block, other = _split(rules, "is-lesson-compact")
    assert audit.find_legacy_dependencies(block, other) == []


def test_equal_specificity_later_unlayered_not_flagged(audit, cpl):
    """Same specificity, unlayered rule declared LATER (e.g. a mobile
    ``@media`` override of a wrapped base rule): it already wins by source
    order, so wrapping the earlier base changes nothing - not a flip."""
    css = ".x { color: red; }\n.x { color: blue; }\n"
    rules = cpl.parse_css(css)  # rules[0] earlier, rules[1] later
    # block = the EARLIER rule, other = the LATER unlayered rule.
    assert audit.find_legacy_dependencies([rules[0]], [rules[1]]) == []


def test_equal_specificity_earlier_unlayered_is_flagged(audit, cpl):
    """Same specificity, unlayered rule declared EARLIER: the block rule
    (later) currently wins by source order and would lose it after wrapping
    - a real flip."""
    css = ".x { color: red; }\n.x { color: blue; }\n"
    rules = cpl.parse_css(css)
    # block = the LATER rule, other = the EARLIER unlayered rule.
    deps = audit.find_legacy_dependencies([rules[1]], [rules[0]])
    assert len(deps) == 1
    assert deps[0].block_prop == "color"


def test_shorthand_longhand_overlap_flagged(audit, cpl):
    """margin (block) collides with margin-top (unlayered) after expansion."""
    css = ".panel { margin-top: 0; }\n.host .panel { margin: 1rem; }\n"
    rules = cpl.parse_css(css)
    block, other = _split(rules, ".host")
    deps = audit.find_legacy_dependencies(block, other)
    assert len(deps) == 1
    assert deps[0].block_prop == "margin"


# --------------------------------------------------------------------------
# layer-region classification
# --------------------------------------------------------------------------


def test_line_is_unlayered(audit):
    css = (
        "/* 1 */\n"
        ".base { color: red; }\n"  # line 2 - unlayered
        "@layer legacy {\n"  # line 3
        ".wrapped { color: blue; }\n"  # line 4 - layered
        "}\n"  # line 5
        ".after { color: green; }\n"  # line 6 - unlayered
    )
    regions = audit.cpl.layer_regions(css)
    assert regions == [("legacy", 3, 5)]
    assert audit.cpl.line_is_unlayered(2, regions) is True
    assert audit.cpl.line_is_unlayered(4, regions) is False
    assert audit.cpl.line_is_unlayered(6, regions) is True


# --------------------------------------------------------------------------
# #1571 regression: the utility-conflict path still fires
# --------------------------------------------------------------------------


def test_navgroup_label_utility_conflict_still_detected(audit, cpl):
    """The proven #1571 case: ``.nav-group-label {display:none}`` vs the
    ``block`` utility must still register as a UTILITY conflict (not a
    legacy dependency) - the new check must not cannibalise the old one."""
    rule = cpl.parse_css(".app-nav .nav-group-label { display: none; }")[0]
    subject = audit.cpl.analyze_selector_part(".app-nav .nav-group-label")
    element = audit.ElementUse(
        file=Path("NavGroup.tsx"),
        line=36,
        tag="span",
        tokens={"nav-group-label", "block"},
    )
    oracle = {
        "block": [
            audit.UtilityDecl(
                prop="display",
                value="block",
                atoms=cpl.expand_property("display"),
                condition=None,
                pseudo_element=None,
                on_descendant=False,
            )
        ]
    }
    conflicts, notes = audit._match_element(rule, subject, element, oracle, via_tag=False)
    assert any(c.rule_prop == "display" and c.utility == "block" for c in conflicts)
    assert notes == []  # display:none vs display:block is a real flip, not wertgleich


# --------------------------------------------------------------------------
# Accepted-conflicts allowlist (#1623)
# --------------------------------------------------------------------------


def _fake_finding(selector: str, prop: str, utility: str):
    """A duck-typed Finding: apply_allowlist only reads these three."""
    return SimpleNamespace(
        subject=SimpleNamespace(selector_part=selector),
        rule_prop=prop,
        utility=utility,
    )


def test_load_accepted_missing_file_returns_empty(audit, monkeypatch, tmp_path):
    monkeypatch.setattr(audit, "ACCEPTED_FILE", tmp_path / "does-not-exist.json")
    assert audit.load_accepted() == {}


def test_load_accepted_parses_valid_entry(audit, monkeypatch, tmp_path):
    path = tmp_path / "accepted.json"
    path.write_text(
        json.dumps(
            {
                "accepted": [
                    {
                        "block": "Onboarding page",
                        "legacy_selector": ".form-hint",
                        "property": "color",
                        "override_utility": "text-warning",
                        "reason": "intended warning hint",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(audit, "ACCEPTED_FILE", path)
    accepted = audit.load_accepted()
    assert accepted == {
        ("Onboarding page", ".form-hint", "color", "text-warning"): "intended warning hint"
    }


def test_load_accepted_requires_reason(audit, monkeypatch, tmp_path):
    path = tmp_path / "accepted.json"
    path.write_text(
        json.dumps(
            {
                "accepted": [
                    {
                        "block": "Onboarding page",
                        "legacy_selector": ".form-hint",
                        "property": "color",
                        "override_utility": "text-warning",
                        "reason": "   ",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(audit, "ACCEPTED_FILE", path)
    with pytest.raises(ValueError, match="reason"):
        audit.load_accepted()


def test_apply_allowlist_downgrades_matching_conflict(audit):
    report = audit.BlockReport(label="Onboarding page", start=0, end=0)
    report.conflicts = [_fake_finding(".form-hint", "color", "text-warning")]
    accepted = {("Onboarding page", ".form-hint", "color", "text-warning"): "intended"}
    audit.apply_allowlist(report, accepted)
    assert report.conflicts == []
    assert len(report.accepted_notes) == 1
    assert report.accepted_notes[0][1] == "intended"


def test_apply_allowlist_keeps_unlisted_conflict_in_same_block(audit):
    """A different override in the SAME block must still be a KONFLIKT (#1623 scoping)."""
    report = audit.BlockReport(label="Onboarding page", start=0, end=0)
    kept = _fake_finding(".form-hint", "color", "text-danger")
    report.conflicts = [kept]
    accepted = {("Onboarding page", ".form-hint", "color", "text-warning"): "intended"}
    audit.apply_allowlist(report, accepted)
    assert report.conflicts == [kept]
    assert report.accepted_notes == []


# --------------------------------------------------------------------------
# Virtual multi-file stylesheet (#1655 concern split)
# --------------------------------------------------------------------------


def _write_stylesheet_tree(tmp_path: Path) -> tuple[Path, Path]:
    """Author a minimal global.css + styles/legacy tree for the loader tests."""
    legacy_dir = tmp_path / "legacy"
    legacy_dir.mkdir()
    (legacy_dir / "00-head.css").write_text(":root { --x: 1; }\n", encoding="utf-8")
    (legacy_dir / "01-base.css").write_text(
        ".nav-links { display: flex; }\n.sr-only { position: absolute; }\n",
        encoding="utf-8",
    )
    global_css = tmp_path / "global.css"
    global_css.write_text(
        '@import "./legacy/00-head.css";\n'
        '@import "./legacy/01-base.css";\n'
        ".app-nav .nav-links { display: none; }\n",
        encoding="utf-8",
    )
    return global_css, legacy_dir


def test_load_css_virtual_orders_legacy_before_global(audit, tmp_path):
    """Legacy concern files precede the global.css body (cascade order after
    @import inlining), with continuous 1-based virtual line numbers and the
    global.css segment LAST."""
    global_css, legacy_dir = _write_stylesheet_tree(tmp_path)
    css_text, segments = audit.load_css_virtual(global_css, legacy_dir)
    assert [s.label for s in segments] == [
        "legacy/00-head.css",
        "legacy/01-base.css",
        "global.css",
    ]
    assert [(s.start, s.count) for s in segments] == [(1, 1), (2, 2), (4, 3)]
    lines = css_text.splitlines()
    assert lines[0].startswith(":root")
    assert lines[3].startswith("@import")


def test_load_css_virtual_without_legacy_dir(audit, tmp_path):
    """Before the first peel there is no styles/legacy - global.css alone."""
    global_css = tmp_path / "global.css"
    global_css.write_text(".a { color: var(--x); }", encoding="utf-8")
    css_text, segments = audit.load_css_virtual(global_css, tmp_path / "legacy")
    assert [s.label for s in segments] == ["global.css"]
    assert segments[0].start == 1
    assert css_text.endswith("\n")


def test_fmt_loc_maps_virtual_lines(audit, tmp_path):
    """Virtual line numbers resolve to file-qualified locations; lines
    outside every segment fall back to the bare global.css form."""
    global_css, legacy_dir = _write_stylesheet_tree(tmp_path)
    _css_text, segments = audit.load_css_virtual(global_css, legacy_dir)
    assert audit.fmt_loc(1, segments) == "legacy/00-head.css:1"
    assert audit.fmt_loc(3, segments) == "legacy/01-base.css:2"
    assert audit.fmt_loc(6, segments) == "global.css:3"
    assert audit.fmt_loc(99, segments) == "global.css:99"


def test_virtual_order_keeps_cross_file_source_order_tiebreak(audit, cpl, tmp_path):
    """The reason legacy files are PREPENDED: an equal-specificity block rule
    in the global.css body is LATER in the cascade than a peeled base rule,
    so it currently wins on source order and MUST be flagged as ABHAENGIG.
    Appending the legacy files instead would invert the tie-break and
    silently drop this dependency (a false negative, against the tool's
    bias)."""
    legacy_dir = tmp_path / "legacy"
    legacy_dir.mkdir()
    (legacy_dir / "01-base.css").write_text(".nav-links { display: flex; }\n", encoding="utf-8")
    global_css = tmp_path / "global.css"
    global_css.write_text(
        '@import "./legacy/01-base.css";\n.nav-links { display: none; }\n',
        encoding="utf-8",
    )
    css_text, segments = audit.load_css_virtual(global_css, legacy_dir)
    rules = cpl.parse_css(css_text)
    global_start = segments[-1].start
    block = [r for r in rules if r.line >= global_start]
    other = [r for r in rules if r.line < global_start]
    deps = audit.find_legacy_dependencies(block, other)
    assert len(deps) == 1
    assert audit.fmt_loc(deps[0].other_rule.line, segments) == "legacy/01-base.css:1"
