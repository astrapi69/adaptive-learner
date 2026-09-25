"""#3069 - the manual test plan's de/en parity is gated, per the contract.

TESTPLAN-PFLICHT binds every PR with user-visible behaviour to update BOTH
`docs/manual-tests/testplan-adaptive-learner.md` and its `-en` sibling. It
was enforced by nothing: #3065 found two checkpoints that existed only in
the German plan, by hand. `verify_docs.py` gated en/de parity for
`docs/help/**` and never mentioned the test plan.

The five tests below are the gate contract (quality-checks.md "Gate test
contract", #2083), in order:

1. it detects the violation,
2. it passes on a clean tree,
3. it fails CLOSED when its own basis is missing,
4. it reports WHAT it measured,
5. its number means the same thing on every run.

Test 1 covers each finding class separately, because a gate that fires on
one class and is blind to the others reads identical from the outside.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from verify_docs import FAIL, Report, check_testplan_parity  # noqa: E402

DE_REL = Path("docs") / "manual-tests" / "testplan-adaptive-learner.md"
EN_REL = Path("docs") / "manual-tests" / "testplan-adaptive-learner-en.md"

# A minimal pair that is in sync: same checkpoint count, same section
# count, same issue references. Section ORDER differs on purpose - the
# real plans order sections differently around positions 23 to 27, and a
# gate that trips on that would be unusable.
DE_PLAN = """# Testplan

### TS-0001 Erster Abschnitt (#1111)
- [ ] TC-0001 Erster Punkt (#2222)
- [ ] TC-0002 Zweiter Punkt

### TS-0002 Zweiter Abschnitt
- [ ] TC-0003 Dritter Punkt (#3333)
"""

EN_PLAN = """# Test plan

### TS-0002 Second section
- [ ] TC-0003 Third item (#3333)

### TS-0001 First section (#1111)
- [ ] TC-0001 First item (#2222)
- [ ] TC-0002 Second item
"""

# The #3274 / #3279 ID register the fixtures above are numbered against.
REGISTER_REL = Path("docs") / "manual-tests" / "testplan-ids.json"
REGISTER = json.dumps(
    {
        prefix: {"highest": {"TC": 3, "TS": 2}.get(prefix, 0), "retired": []}
        for prefix in ("TC", "TS", "RTC", "RTS", "LTC", "LTS", "GTC", "GTS", "OTC", "OTS")
        + ("DTC", "DTS")
    }
)


def _fails(report: Report) -> list[str]:
    return [f.message for f in report.findings if f.severity == FAIL]


def _tree(
    root: Path,
    de: str | None = DE_PLAN,
    en: str | None = EN_PLAN,
    register: str | None = REGISTER,
) -> Path:
    """Build a throwaway repo shape holding the two plans and the ID register."""
    for rel, body in ((DE_REL, de), (EN_REL, en), (REGISTER_REL, register)):
        if body is None:
            continue
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body, encoding="utf-8")
    return root


def _run(root: Path) -> Report:
    report = Report()
    check_testplan_parity(report, plan_dir=root)
    return report


# --- 1. it detects the violation -------------------------------------------


class TestDetectsTheViolation:
    def test_checkpoint_missing_on_one_side_fails(self, tmp_path: Path) -> None:
        """The #3065 shape: a whole `- [ ]` item exists only in German."""
        en_short = EN_PLAN.replace("- [ ] TC-0002 Second item\n", "")
        report = _run(_tree(tmp_path, en=en_short))
        assert report.fail_count >= 1
        joined = " ".join(_fails(report))
        assert "checkpoint counts differ" in joined
        assert "de has 3, en has 2" in joined

    def test_issue_reference_only_on_one_side_fails(self, tmp_path: Path) -> None:
        """The second #3065 shape: a reference dropped from a heading."""
        en_no_ref = EN_PLAN.replace("First section (#1111)", "First section")
        report = _run(_tree(tmp_path, en=en_no_ref))
        assert report.fail_count >= 1
        joined = " ".join(_fails(report))
        assert "only in the DE plan" in joined
        assert "#1111" in joined

    def test_reference_cited_a_different_number_of_times_fails(self, tmp_path: Path) -> None:
        en_extra = EN_PLAN.replace("- [ ] TC-0002 Second item", "- [ ] TC-0002 Second item (#2222)")
        report = _run(_tree(tmp_path, en=en_extra))
        assert report.fail_count >= 1
        joined = " ".join(_fails(report))
        assert "different number of times" in joined
        assert "#2222 (de 1, en 2)" in joined

    def test_section_count_drift_fails(self, tmp_path: Path) -> None:
        de_extra = DE_PLAN + "\n### Dritter Abschnitt\n"
        report = _run(_tree(tmp_path, de=de_extra))
        assert report.fail_count >= 1
        assert any("section counts differ" in m for m in _fails(report))

    def test_checkpoint_without_id_fails(self, tmp_path: Path) -> None:
        """#3274: every checkpoint carries a permanent ID."""
        de_bare = DE_PLAN.replace("- [ ] TC-0002 Zweiter", "- [ ] Zweiter")
        report = _run(_tree(tmp_path, de=de_bare))
        assert any("checkbox without an ID" in m for m in _fails(report))

    def test_id_only_on_one_side_fails(self, tmp_path: Path) -> None:
        """#3274: DE and EN carry the same ID for the same case."""
        en_other = EN_PLAN.replace("TC-0003 Third", "TC-0009 Third")
        report = _run(_tree(tmp_path, en=en_other))
        joined = " ".join(_fails(report))
        assert "TC-0003 exists only in" in joined
        assert "above the register limit" in joined


# --- 1b. it is actually wired into the runner ------------------------------


class TestTheCheckIsRegistered:
    """A check that exists but is never run is the #2077 shape.

    checks.yaml probes this entry via `script_exists` on THIS file, which
    proves the test exists, not that the check is in the runner. This
    pins the half the probe cannot see.
    """

    def test_registry_contains_the_check(self) -> None:
        from verify_docs import CHECKS

        assert "testplan-parity" in CHECKS

    def test_default_run_includes_it(self) -> None:
        """`verify_docs.py` with no --check must run it, not just offer it."""
        from verify_docs import CHECKS

        assert list(CHECKS).index("testplan-parity") >= 0
        report = Report()
        CHECKS["testplan-parity"](report, None)
        assert any(n.startswith("testplan-parity:") for n in report.notes)


class TestTheIdCheckIsRegistered:
    """#3274: the single-language plans (RTC-, LTC-) run as their own check."""

    def test_default_run_includes_it(self) -> None:
        from verify_docs import CHECKS

        report = Report()
        CHECKS["testplan-ids"](report, None)
        assert report.fail_count == 0, _fails(report)
        assert any(n.startswith("testplan-ids RTC:") for n in report.notes)
        assert any(n.startswith("testplan-ids LTC:") for n in report.notes)
        for prefix in ("GTC", "GTS", "OTC", "OTS", "DTC", "DTS"):
            assert any(n.startswith(f"testplan-ids {prefix}:") for n in report.notes), prefix

    def test_the_parity_check_reports_the_tc_ids(self) -> None:
        report = Report()
        check_testplan_parity(report)
        assert any(n.startswith("testplan-ids TC:") for n in report.notes)


# --- 2. it passes on a clean tree ------------------------------------------


class TestPassesOnACleanTree:
    def test_synced_pair_produces_no_finding(self, tmp_path: Path) -> None:
        report = _run(_tree(tmp_path))
        assert report.fail_count == 0, _fails(report)

    def test_differing_section_order_is_not_a_finding(self, tmp_path: Path) -> None:
        """Order is not drift: the fixtures above already differ in order."""
        report = _run(_tree(tmp_path))
        assert report.fail_count == 0
        assert DE_PLAN.index("Erster Abschnitt") < DE_PLAN.index("Zweiter Abschnitt")
        assert EN_PLAN.index("Second section") < EN_PLAN.index("First section")

    def test_the_shipped_plans_are_in_sync(self) -> None:
        """The gate must be green on the real repo, not only on fixtures."""
        report = Report()
        check_testplan_parity(report)
        assert report.fail_count == 0, _fails(report)


# --- 3. it fails closed when its basis is missing --------------------------


class TestFailsClosed:
    def test_missing_english_plan_fails(self, tmp_path: Path) -> None:
        report = _run(_tree(tmp_path, en=None))
        assert report.fail_count == 1
        assert "not found" in _fails(report)[0]

    def test_missing_german_plan_fails(self, tmp_path: Path) -> None:
        report = _run(_tree(tmp_path, de=None))
        assert report.fail_count == 1
        assert "not found" in _fails(report)[0]

    def test_missing_id_register_fails(self, tmp_path: Path) -> None:
        """#3274: without the register the ID half cannot run - never green."""
        report = _run(_tree(tmp_path, register=None))
        assert report.fail_count == 1
        assert "no ID register" in _fails(report)[0]

    def test_two_empty_plans_fail_instead_of_matching_vacuously(self, tmp_path: Path) -> None:
        """Emptiness against emptiness is agreement, not verification."""
        report = _run(_tree(tmp_path, de="# Testplan\n", en="# Test plan\n"))
        assert report.fail_count == 1
        assert "vacuously true" in _fails(report)[0]


# --- 4. it reports what it measured ----------------------------------------


class TestReportsWhatItMeasured:
    def test_note_carries_both_sides_counts(self, tmp_path: Path) -> None:
        report = _run(_tree(tmp_path))
        note = next((n for n in report.notes if n.startswith("testplan-parity:")), None)
        assert note is not None, report.notes
        assert "de 3 checkpoints / 2 sections" in note
        assert "en 3 checkpoints / 2 sections" in note

    def test_no_note_when_the_basis_is_missing(self, tmp_path: Path) -> None:
        """A count note would claim a measurement that never happened."""
        report = _run(_tree(tmp_path, en=None))
        assert not [n for n in report.notes if n.startswith("testplan-parity:")]


# --- 5. its number means the same thing everywhere -------------------------


class TestTheNumberIsStable:
    def test_two_runs_on_identical_input_agree(self, tmp_path: Path) -> None:
        """No tool version, no platform, no clock: a pure read of committed text."""
        first, second = _run(_tree(tmp_path)), _run(_tree(tmp_path))
        assert [n for n in first.notes] == [n for n in second.notes]
        assert first.fail_count == second.fail_count == 0

    def test_the_shipped_plans_measure_the_same_twice(self) -> None:
        reports = []
        for _ in range(2):
            report = Report()
            check_testplan_parity(report)
            reports.append(report)
        assert reports[0].notes == reports[1].notes
