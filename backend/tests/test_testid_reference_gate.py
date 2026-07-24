"""Unit tests for ``scripts/testid_reference_gate.py`` (#1661).

Repo-level tooling (stdlib only, no ``app.*`` imports), but ``make
test-backend`` is the only Python runner in the ``make test`` green
baseline - so the tests live here, mirroring ``test_verify_theme_script.py``.

Coverage: the literal/reference regexes (static-only, dynamic skipped),
net-removal diff parsing (move/rename is not a removal), the gate decision
matrix (nothing offending / offending+spec-touched / offending+no-spec),
and an integration assertion that the script runs clean against the real
repo tree with an empty diff (HEAD...HEAD).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
_SCRIPT = REPO / "scripts" / "testid_reference_gate.py"

_spec = importlib.util.spec_from_file_location("testid_reference_gate", _SCRIPT)
assert _spec and _spec.loader
trg = importlib.util.module_from_spec(_spec)
sys.modules["testid_reference_gate"] = trg
_spec.loader.exec_module(trg)


# --------------------------------------------------------------------------
# extract_testid_literals
# --------------------------------------------------------------------------


def test_extract_literals_double_and_single_quotes() -> None:
    text = "data-testid=\"lesson-check\" and data-testid='lesson-next'"
    assert trg.extract_testid_literals(text) == {"lesson-check", "lesson-next"}


def test_extract_literals_skips_template_literal() -> None:
    """Dynamic ``data-testid={`${x}-open`}`` has no static literal to read."""
    text = 'data-testid={`${testId}-open`} data-testid="static-one"'
    assert trg.extract_testid_literals(text) == {"static-one"}


# --------------------------------------------------------------------------
# extract_referenced_testids
# --------------------------------------------------------------------------


def test_extract_referenced_getbytestid_and_locator_and_raw() -> None:
    text = (
        'await page.getByTestId("dashboard").click()\n'
        "page.locator('[data-testid=\"cycle-progress\"]')\n"
        'data-testid="session-end"\n'
    )
    assert trg.extract_referenced_testids(text) == {
        "dashboard",
        "cycle-progress",
        "session-end",
    }


def test_extract_referenced_ignores_dynamic() -> None:
    text = "getByTestId(`${prefix}-open`)"
    assert trg.extract_referenced_testids(text) == set()


# --------------------------------------------------------------------------
# net_removed_testids (unified-diff parsing)
# --------------------------------------------------------------------------


def test_net_removed_simple_removal() -> None:
    diff = (
        "--- a/x.tsx\n"
        "+++ b/x.tsx\n"
        '-      <button data-testid="lesson-pause" />\n'
        "+      <button />\n"
    )
    assert trg.net_removed_testids(diff) == {"lesson-pause"}


def test_net_removed_move_is_not_removal() -> None:
    """A testid removed on one line but re-added on another is a move."""
    diff = (
        "--- a/x.tsx\n"
        "+++ b/x.tsx\n"
        '-  <span data-testid="lesson-title" />\n'
        '+  <h1 data-testid="lesson-title" />\n'
    )
    assert trg.net_removed_testids(diff) == set()


def test_net_removed_ignores_file_headers() -> None:
    """A path containing 'data-testid' in headers must not be parsed."""
    diff = (
        '--- a/data-testid="trap".tsx\n+++ b/data-testid="trap".tsx\n-  data-testid="real-remove"\n'
    )
    assert trg.net_removed_testids(diff) == {"real-remove"}


# --------------------------------------------------------------------------
# evaluate_gate decision matrix
# --------------------------------------------------------------------------


def test_gate_nothing_offending_passes() -> None:
    ok, offending = trg.evaluate_gate(
        referenced={"a", "b"},
        net_removed_on_watched={"unreferenced"},
        spec_changed=False,
    )
    assert ok is True
    assert offending == set()


def test_gate_offending_without_spec_change_blocks() -> None:
    ok, offending = trg.evaluate_gate(
        referenced={"lesson-pause", "b"},
        net_removed_on_watched={"lesson-pause"},
        spec_changed=False,
    )
    assert ok is False
    assert offending == {"lesson-pause"}


def test_gate_offending_with_spec_change_passes() -> None:
    ok, offending = trg.evaluate_gate(
        referenced={"lesson-pause"},
        net_removed_on_watched={"lesson-pause"},
        spec_changed=True,
    )
    assert ok is True
    assert offending == {"lesson-pause"}


# --------------------------------------------------------------------------
# helpers used by the CLI
# --------------------------------------------------------------------------


def test_spec_changed_detects_e2e_ts_only() -> None:
    assert trg._spec_changed(["e2e/dexie/lesson-tts.spec.ts"]) is True
    assert trg._spec_changed(["e2e/helpers/setup.ts"]) is True
    assert trg._spec_changed(["frontend/src/components/lesson/Lesson.tsx"]) is False
    assert trg._spec_changed(["e2e/visual/screenshots/x.png"]) is False


# --------------------------------------------------------------------------
# integration: runs clean against the real tree with an empty diff
# --------------------------------------------------------------------------


def test_run_clean_on_empty_diff() -> None:
    """HEAD...HEAD has no removed testids -> gate not applicable -> exit 0."""
    assert trg.run(base="HEAD", head="HEAD") == 0


def test_real_repo_has_referenced_testids() -> None:
    """Sanity: the referenced-testid oracle finds the real spec references."""
    referenced = trg._collect_referenced_testids()
    assert "dashboard" in referenced
    assert len(referenced) > 100
