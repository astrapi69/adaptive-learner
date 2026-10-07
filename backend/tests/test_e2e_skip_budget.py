"""Tests for the runtime skip budget of the nightly e2e suites (#3427).

A spec that cannot reach its surface skips at runtime, so a regression that
breaks the path removes the surface from the gate while the run reads green.
The checker reads the skipped tests from Playwright's JSON report and holds
each suite to a declared budget; these tests pin the count, the budget
comparison in both directions and the fail-closed paths.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from check_e2e_skip_budget import (  # noqa: E402
    EXIT_FAIL_CLOSED,
    EXIT_OVER_BUDGET,
    check,
    read_outcome,
)


def _test(status: str, reason: str | None = None) -> dict:
    annotations = [{"type": "skip", "description": reason}] if reason else []
    return {"status": status, "annotations": annotations, "results": []}


REPORT = {
    "suites": [
        {
            "title": "review.spec.ts",
            "specs": [
                {"title": "opens", "tests": [_test("expected")]},
                {"title": "drill", "tests": [_test("skipped", "review surface not reached")]},
            ],
            "suites": [
                {
                    "title": "nested describe",
                    "specs": [
                        {"title": "a", "tests": [_test("unexpected")]},
                        {"title": "b", "tests": [_test("skipped")]},
                        {"title": "c", "tests": [_test("flaky")]},
                    ],
                }
            ],
        }
    ]
}


def _write(tmp_path: Path, report: dict | None, budgets: dict | None) -> tuple[Path, Path]:
    report_path, budget_path = tmp_path / "report.json", tmp_path / "budget.json"
    if report is not None:
        report_path.write_text(json.dumps(report), encoding="utf-8")
    if budgets is not None:
        budget_path.write_text(json.dumps({"budgets": budgets}), encoding="utf-8")
    return report_path, budget_path


def test_read_outcome_counts_nested_tests_and_names_the_skipped_ones() -> None:
    outcome = read_outcome(REPORT)
    assert outcome.total == 5
    assert outcome.skipped == [
        "review.spec.ts > drill (review surface not reached)",
        "review.spec.ts > nested describe > b (no reason given)",
    ]


@pytest.mark.parametrize(
    ("budget", "code"),
    [(1, EXIT_OVER_BUDGET), (2, 0), (3, 0)],
    ids=["over-budget", "at-budget", "under-budget"],
)
def test_check_compares_the_skips_with_the_budget(tmp_path: Path, budget: int, code: int) -> None:
    report, budgets = _write(tmp_path, REPORT, {"dexie-smoke": budget})
    assert check("dexie-smoke", report, budgets) == code


def test_check_offers_a_lower_budget_without_banking_it(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    report, budgets = _write(tmp_path, REPORT, {"dexie-smoke": 5})
    assert check("dexie-smoke", report, budgets) == 0
    assert "can drop to 2" in capsys.readouterr().out
    assert json.loads(budgets.read_text())["budgets"]["dexie-smoke"] == 5


@pytest.mark.parametrize(
    ("report", "budgets", "suite"),
    [
        (None, {"dexie-smoke": 2}, "dexie-smoke"),
        ({"suites": []}, {"dexie-smoke": 2}, "dexie-smoke"),
        (REPORT, None, "dexie-smoke"),
        (REPORT, {"dexie-smoke": 2}, "manual-automation"),
        (REPORT, {"dexie-smoke": None}, "dexie-smoke"),
    ],
    ids=["no-report", "empty-report", "no-budget-file", "suite-without-budget", "null-budget"],
)
def test_check_fails_closed(
    tmp_path: Path, report: dict | None, budgets: dict | None, suite: str
) -> None:
    report_path, budget_path = _write(tmp_path, report, budgets)
    assert check(suite, report_path, budget_path) == EXIT_FAIL_CLOSED


def test_the_committed_budget_covers_every_wired_suite() -> None:
    budgets = json.loads((REPO / "e2e" / ".runtime-skip-budget.json").read_text())["budgets"]
    workflows = (REPO / ".github" / "workflows").glob("*.yml")
    wired = {
        line.split("--suite", 1)[1].split()[0]
        for path in workflows
        for line in path.read_text(encoding="utf-8").splitlines()
        if "check_e2e_skip_budget.py" in line and "--suite" in line
    }
    assert wired, "no workflow runs the skip budget"
    assert wired <= set(budgets), f"suites without a budget: {sorted(wired - set(budgets))}"
