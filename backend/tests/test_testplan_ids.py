"""#3274 - every manual test-plan checkpoint carries a permanent ID.

`scripts/testplan_ids.py` assigns (`--assign`) and checks (`--check`) the
IDs. The tests follow the gate contract (quality-checks.md "Gate test
contract", #2083):

1. it detects each violation class,
2. it passes on a clean tree,
3. it fails CLOSED when its own basis is missing,
4. it reports WHAT it measured,
5. its number means the same thing on every run.

The assignment tests pin the append-only rule: a new case takes the next
free number, a deleted case never returns its number, and DE and EN get
the same ID for the same case even when their section order differs.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

import testplan_ids  # noqa: E402
from testplan_ids import (  # noqa: E402
    DE_REL,
    EN_REL,
    LAUNCHER_REL,
    REFERENCE_REL,
    REGISTER_REL,
    assign,
    check,
    parse_plan,
)

# Section ORDER differs between DE and EN on purpose - the real plans do the
# same, so positional pairing would link the wrong cases.
DE_PLAN = """# Testplan

### Erster Abschnitt (#1111)
- [ ] Erster Punkt (#2222)
- [ ] Zweiter Punkt
      mit Fortsetzungszeile

### Zweiter Abschnitt
- [ ] Dritter Punkt (#3333)
"""

EN_PLAN = """# Test plan

### Second section
- [ ] Third item (#3333)

### First section (#1111)
- [ ] First item (#2222)
- [ ] Second item
      with a continuation line
"""

SINGLE_PLAN = """# Plan

## State 1
- [ ] One
- [ ] Two
"""

EMPTY_REGISTER = {
    "TC": {"highest": 0, "retired": []},
    "RTC": {"highest": 0, "retired": []},
    "LTC": {"highest": 0, "retired": []},
}


def _write(root: Path, rel: Path, body: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")


def _tree(
    root: Path,
    de: str | None = DE_PLAN,
    en: str | None = EN_PLAN,
    register: dict | None = None,
) -> Path:
    for rel, body in ((DE_REL, de), (EN_REL, en)):
        if body is not None:
            _write(root, rel, body)
    _write(root, REFERENCE_REL, SINGLE_PLAN)
    _write(root, LAUNCHER_REL, SINGLE_PLAN)
    _write(root, REGISTER_REL, json.dumps(register or EMPTY_REGISTER))
    return root


def _assigned(root: Path) -> Path:
    """A clean tree: build it, then let the script number it."""
    outcome = assign(_tree(root))
    assert not outcome.unresolved, outcome.unresolved
    return root


def _read(root: Path, rel: Path) -> str:
    return (root / rel).read_text(encoding="utf-8")


def _edit(root: Path, rel: Path, old: str, new: str) -> None:
    text = _read(root, rel)
    assert old in text, old
    _write(root, rel, text.replace(old, new, 1))


def _joined(root: Path) -> str:
    return "\n".join(check(root).findings)


# --- assignment ------------------------------------------------------------


class TestAssign:
    def test_de_and_en_get_the_same_id_for_the_same_case(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        de, en = _read(root, DE_REL), _read(root, EN_REL)
        assert "- [ ] TC-0001 Erster Punkt (#2222)" in de
        assert "- [ ] TC-0001 First item (#2222)" in en
        assert "- [ ] TC-0002 Zweiter Punkt" in de
        assert "- [ ] TC-0002 Second item" in en
        assert "- [ ] TC-0003 Dritter Punkt (#3333)" in de
        assert "- [ ] TC-0003 Third item (#3333)" in en

    def test_single_plans_get_their_own_prefix_and_number_space(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        assert "- [ ] RTC-0001 One" in _read(root, REFERENCE_REL)
        assert "- [ ] LTC-0002 Two" in _read(root, LAUNCHER_REL)

    def test_register_records_the_highest_number(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        register = json.loads(_read(root, REGISTER_REL))
        assert register["TC"] == {"highest": 3, "retired": []}
        assert register["RTC"]["highest"] == 2

    def test_only_the_id_is_inserted_nothing_else_changes(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        stripped = _read(root, DE_REL).replace("TC-0001 ", "")
        stripped = stripped.replace("TC-0002 ", "").replace("TC-0003 ", "")
        assert stripped == DE_PLAN

    def test_second_run_is_a_no_op(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        before = {rel: _read(root, rel) for rel in (DE_REL, EN_REL, REGISTER_REL)}
        outcome = assign(root)
        assert outcome.assigned == 0
        assert {rel: _read(root, rel) for rel in before} == before

    def test_new_case_mid_document_takes_the_next_free_number(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, DE_REL, "- [ ] TC-0002 Zweiter", "- [ ] Neu (#4444)\n- [ ] TC-0002 Zweiter")
        _edit(root, EN_REL, "- [ ] TC-0002 Second", "- [ ] New (#4444)\n- [ ] TC-0002 Second")
        assign(root)
        assert "- [ ] TC-0004 Neu (#4444)" in _read(root, DE_REL)
        assert "- [ ] TC-0004 New (#4444)" in _read(root, EN_REL)

    def test_deleted_number_is_retired_and_never_reused(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, DE_REL, "- [ ] TC-0003 Dritter Punkt (#3333)\n", "- [ ] Ersatz\n")
        _edit(root, EN_REL, "- [ ] TC-0003 Third item (#3333)\n", "- [ ] Replacement\n")
        assign(root)
        register = json.loads(_read(root, REGISTER_REL))
        assert register["TC"] == {"highest": 4, "retired": [3]}
        assert "- [ ] TC-0004 Ersatz" in _read(root, DE_REL)
        assert check(root).findings == []

    def test_differing_order_inside_a_section_is_refused_not_guessed(self, tmp_path: Path) -> None:
        """Positional pairing inside a section would link two different cases."""
        de = DE_PLAN.replace("- [ ] Zweiter Punkt", "- [ ] Zweiter Punkt (#5555)")
        en = EN_PLAN.replace(
            "- [ ] First item (#2222)\n- [ ] Second item\n      with a continuation line\n",
            "- [ ] Second item (#5555)\n- [ ] First item (#2222)\n",
        )
        outcome = assign(_tree(tmp_path, de=de, en=en))
        assert outcome.unresolved
        assert "Erster Punkt" in _read(tmp_path, DE_REL)
        assert "TC-" not in _read(tmp_path, DE_REL).split("### Erster")[1].split("###")[0]

    def test_hand_decided_pairs_resolve_a_reordered_section(self, tmp_path: Path) -> None:
        de = DE_PLAN.replace("- [ ] Zweiter Punkt", "- [ ] Zweiter Punkt (#5555)")
        en = EN_PLAN.replace(
            "- [ ] First item (#2222)\n- [ ] Second item\n      with a continuation line\n",
            "- [ ] Second item (#5555)\n- [ ] First item (#2222)\n",
        )
        root = _tree(tmp_path, de=de, en=en)
        de_lines = {b.refs: b.line_no for b in parse_plan(DE_REL, de).boxes}
        en_lines = {b.refs: b.line_no for b in parse_plan(EN_REL, en).boxes}
        manual = {de_lines[r]: en_lines[r] for r in (("2222",), ("5555",))}
        outcome = assign(root, manual)
        assert not outcome.unresolved
        assert outcome.by_hand == 2
        assert "- [ ] TC-0001 First item (#2222)" in _read(root, EN_REL)
        assert "- [ ] TC-0002 Second item (#5555)" in _read(root, EN_REL)
        assert check(root).findings == []

    def test_section_with_different_counts_is_refused(self, tmp_path: Path) -> None:
        en = EN_PLAN.replace("- [ ] Second item\n      with a continuation line\n", "")
        outcome = assign(_tree(tmp_path, en=en))
        assert any("Erster Abschnitt" in item for item in outcome.unresolved)


# --- 1. the check detects each violation class -----------------------------


class TestDetectsTheViolation:
    def test_checkbox_without_id_names_file_and_line(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, DE_REL, "- [ ] TC-0003 Dritter", "- [ ] Dritter")
        joined = _joined(root)
        assert f"{DE_REL}:9: checkbox without an ID" in joined

    def test_duplicate_id_fails(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, DE_REL, "TC-0003 Dritter", "TC-0001 Dritter")
        assert "TC-0001 used twice" in _joined(root)

    def test_id_only_in_de_fails(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, EN_REL, "TC-0003 Third", "TC-0009 Third")
        joined = _joined(root)
        assert f"TC-0003 exists only in {DE_REL}" in joined

    def test_section_count_drift_names_the_section(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, EN_REL, "- [ ] TC-0002 Second item\n      with a continuation line\n", "")
        joined = _joined(root)
        assert "section '### Erster Abschnitt (#1111)'" in joined
        assert "has 2 checkpoint(s)" in joined

    def test_id_above_register_limit_fails(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, DE_REL, "TC-0003 Dritter", "TC-0099 Dritter")
        _edit(root, EN_REL, "TC-0003 Third", "TC-0099 Third")
        assert "TC-0099 is above the register limit" in _joined(root)

    def test_reused_retired_number_fails(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        register = json.loads(_read(root, REGISTER_REL))
        register["TC"] = {"highest": 3, "retired": [3]}
        _write(root, REGISTER_REL, json.dumps(register))
        assert "TC-0003 is retired" in _joined(root)

    def test_silently_deleted_case_fails_until_retired(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, DE_REL, "- [ ] TC-0003 Dritter Punkt (#3333)\n", "")
        _edit(root, EN_REL, "- [ ] TC-0003 Third item (#3333)\n", "")
        assert "TC-0003 is in the register range but in no plan" in _joined(root)

    def test_same_id_on_different_cases_is_caught_by_references(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, EN_REL, "TC-0001 First item (#2222)", "TC-0002 First item (#2222)")
        _edit(root, EN_REL, "TC-0002 Second item", "TC-0001 Second item")
        assert "the ID may name two different cases" in _joined(root)

    def test_wrong_prefix_fails(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _edit(root, LAUNCHER_REL, "LTC-0001 One", "RTC-0001 One")
        assert "wrong prefix" in _joined(root)


# --- 2. it passes on a clean tree ------------------------------------------


class TestPassesOnACleanTree:
    def test_assigned_fixture_is_clean(self, tmp_path: Path) -> None:
        assert check(_assigned(tmp_path)).findings == []

    def test_the_shipped_plans_are_clean(self) -> None:
        result = check()
        assert result.findings == [], result.findings[:10]


# --- 3. it fails closed when its basis is missing --------------------------


class TestFailsClosed:
    def test_missing_register_fails(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        (root / REGISTER_REL).unlink()
        assert "no ID register" in _joined(root)

    def test_malformed_register_fails(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _write(root, REGISTER_REL, json.dumps({"TC": {"highest": "many"}}))
        assert "needs an int 'highest'" in _joined(root)

    def test_missing_plan_fails(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        (root / EN_REL).unlink()
        assert "not found" in _joined(root)

    def test_empty_plan_fails_instead_of_passing_vacuously(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        _write(root, LAUNCHER_REL, "# Plan\n")
        assert "vacuously" in _joined(root)


# --- 4. it reports what it measured ----------------------------------------


class TestReportsWhatItMeasured:
    def test_notes_carry_counts_per_id_space(self, tmp_path: Path) -> None:
        notes = check(_assigned(tmp_path)).notes
        assert any(
            n.startswith("testplan-ids TC:") and "3 distinct IDs" in n and "TC-0003" in n
            for n in notes
        ), notes
        assert any(n.startswith("testplan-ids LTC:") for n in notes)


# --- 5. its number means the same thing everywhere -------------------------


class TestTheNumberIsStable:
    def test_two_runs_agree(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        first, second = check(root), check(root)
        assert first.notes == second.notes
        assert first.findings == second.findings == []


# --- CLI -------------------------------------------------------------------


class TestCli:
    def test_check_exit_codes(self, tmp_path: Path) -> None:
        root = _assigned(tmp_path)
        assert testplan_ids.main(["--check", "--root", str(root)]) == 0
        _edit(root, DE_REL, "- [ ] TC-0003 Dritter", "- [ ] Dritter")
        assert testplan_ids.main(["--check", "--root", str(root)]) == 1

    @pytest.mark.parametrize("flag", ["--assign", "--check"])
    def test_missing_register_is_not_green(self, tmp_path: Path, flag: str) -> None:
        root = _tree(tmp_path)
        (root / REGISTER_REL).unlink()
        assert testplan_ids.main([flag, "--root", str(root)]) != 0
