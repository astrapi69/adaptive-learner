"""Unit tests for the ``--unstyled`` mode of ``scripts/check-dead-classnames.py``
(#1892).

The base #1491 gate catches new dead class *names*. The ``--unstyled`` mode
catches the render-unstyled *archetype*: a ``className`` whose EVERY token is
a dead class, so the element renders with zero CSS (the #1715/#1732 shape).

The detection is conservative on purpose: only PURELY-STATIC ``className``
values are considered (a ``cn(...)`` call, an identifier ref, or a ``${...}``
template is skipped as unprüfbar), so a flag is a genuine unstyled element,
not a false positive. These tests pin exactly that boundary, plus a
real-repo parity guard so the committed ``.unstyled-classnames-baseline``
cannot silently drift from what the detector computes.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
_SCRIPT = REPO / "scripts" / "check-dead-classnames.py"

_spec = importlib.util.spec_from_file_location("check_dead_classnames", _SCRIPT)
assert _spec and _spec.loader
cdc = importlib.util.module_from_spec(_spec)
sys.modules["check_dead_classnames"] = cdc
_spec.loader.exec_module(cdc)


# --------------------------------------------------------------------------
# static_class_groups: per-attribute token lists, PURELY-STATIC only
# --------------------------------------------------------------------------


def test_plain_string_single_attribute() -> None:
    groups = cdc.static_class_groups('<div className="a b" />')
    assert groups == [["a", "b"]]


def test_two_attributes_two_groups() -> None:
    text = '<div className="a" /><span className="b c" />'
    assert cdc.static_class_groups(text) == [["a"], ["b", "c"]]


def test_braced_single_literal_is_static() -> None:
    assert cdc.static_class_groups('<div className={"foo bar"} />') == [["foo", "bar"]]


def test_template_without_dynamic_is_static() -> None:
    assert cdc.static_class_groups("<div className={`a b`} />") == [["a", "b"]]


def test_cn_call_is_excluded_even_when_all_literal() -> None:
    # Conservative: a merger call is not treated as fully-static (an identifier
    # arg could carry a live class), so it never yields an unstyled flag.
    assert cdc.static_class_groups('<div className={cn("a", "b")} />') == []


def test_template_with_dynamic_is_excluded() -> None:
    assert cdc.static_class_groups("<div className={`a ${x}`} />") == []


def test_ternary_expression_is_excluded() -> None:
    assert cdc.static_class_groups('<div className={cond ? "a" : "b"} />') == []


def test_non_class_tokens_dropped_empty_group_not_returned() -> None:
    # Uppercase / dotted i18n-key-shaped literal -> no valid class token.
    assert cdc.static_class_groups('<div className="Foo.Bar" />') == []


# --------------------------------------------------------------------------
# unstyled_class_values: canonical keys of all-dead static groups
# --------------------------------------------------------------------------


def test_all_dead_tokens_flagged_canonical_sorted() -> None:
    dead = {"dead-a", "dead-b"}
    vals = cdc.unstyled_class_values('<a className="dead-b dead-a" />', dead)
    assert vals == {"dead-a dead-b"}  # sorted, space-joined canonical key


def test_single_dead_token_flagged() -> None:
    assert cdc.unstyled_class_values('<a className="form-field" />', {"form-field"}) == {
        "form-field"
    }


def test_mixed_live_and_dead_not_flagged() -> None:
    # 'flex' is not in the dead set -> the element IS styled -> not a defect.
    assert cdc.unstyled_class_values('<a className="dead-a flex" />', {"dead-a"}) == set()


def test_all_live_not_flagged() -> None:
    assert cdc.unstyled_class_values('<a className="p-4 flex" />', {"dead-a"}) == set()


def test_cn_all_dead_not_flagged_conservative() -> None:
    dead = {"dead-a", "dead-b"}
    assert cdc.unstyled_class_values('<a className={cn("dead-a","dead-b")} />', dead) == set()


def test_duplicate_value_deduped() -> None:
    text = '<a className="form-field" /><b className="form-field" />'
    assert cdc.unstyled_class_values(text, {"form-field"}) == {"form-field"}


# --------------------------------------------------------------------------
# Integration: real repo is green (committed baseline == detector output)
# --------------------------------------------------------------------------


def test_real_repo_unstyled_set_matches_committed_baseline() -> None:
    """The committed .unstyled-classnames-baseline must equal what the
    detector computes over frontend/src using .dead-classnames-baseline as
    the dead oracle. Guards drift in BOTH directions: a new unstyled site
    (added value) and a migrated one (stale baseline entry)."""
    dead = cdc.load_baseline()
    computed: set[str] = set()
    for path in cdc.source_files():
        text = cdc.strip_comments(path.read_text(encoding="utf-8", errors="replace"))
        computed |= cdc.unstyled_class_values(text, dead)
    committed = cdc.load_unstyled_baseline()
    new = computed - committed
    stale = committed - computed
    assert not new, f"unstyled sites not on the baseline (ratchet up): {sorted(new)}"
    assert not stale, f"baseline entries no longer present (ratchet down): {sorted(stale)}"
