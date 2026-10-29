#!/usr/bin/env python3
"""Hold the skipped tests of a nightly e2e suite to a declared budget (#3427).

Many specs skip at runtime when they cannot reach their surface
(``test.skip(!reached, ...)``). That keeps a flaky path from turning the
night red, but a regression that breaks the path to a surface then removes
the surface from the gate and the run still reads green. The smoke suite
budgets its silenced specs by counting spellings (#2170); a runtime skip has
no spelling to count, so this reads the outcome from Playwright's JSON report
instead and compares the number of skipped tests per suite with
``e2e/.runtime-skip-budget.json``.

Usage (in the workflow, after the test step)::

    python3 scripts/check_e2e_skip_budget.py --suite dexie-smoke \\
        --report e2e/test-results/dexie-smoke.json

Gate contract (quality-checks.md "Gate test contract"): a missing or
unreadable report, a report with no tests, or a suite without a budget exits
2; the output names the suite, the tests counted, the skipped ones with their
reasons, and the budget. Growth fails; a drop is reported for a human to
bank (#2140), never banked by the script.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

EXIT_OVER_BUDGET = 1
EXIT_FAIL_CLOSED = 2

BUDGET_FILE = Path("e2e") / ".runtime-skip-budget.json"


@dataclass(frozen=True)
class Outcome:
    """The tests of one report and the skipped ones among them."""

    total: int
    skipped: list[str]


def walk_tests(suite: dict, trail: tuple[str, ...]) -> list[tuple[str, dict]]:
    """Every test of ``suite`` and its nested suites, with a readable title."""
    found = []
    here = trail + ((suite["title"],) if suite.get("title") else ())
    for spec in suite.get("specs", []):
        for test in spec.get("tests", []):
            found.append((" > ".join(here + (spec.get("title", "?"),)), test))
    for child in suite.get("suites", []):
        found.extend(walk_tests(child, here))
    return found


def _reason(test: dict) -> str:
    """The skip reason Playwright recorded, if any."""
    notes = list(test.get("annotations", []))
    for result in test.get("results", []):
        notes.extend(result.get("annotations", []))
    for note in notes:
        if note.get("type") in ("skip", "fixme") and note.get("description"):
            return str(note["description"])
    return "no reason given"


def read_outcome(report: dict) -> Outcome:
    """Count the tests of a Playwright JSON report and name the skipped ones.

    Args:
        report: The parsed report of one ``playwright test`` run.

    Returns:
        The total and the skipped tests as ``"<title> (<reason>)"``.
    """
    tests = [item for suite in report.get("suites", []) for item in walk_tests(suite, ())]
    skipped = [
        f"{title} ({_reason(test)})"
        for title, test in tests
        if test.get("status") == "skipped"
    ]
    return Outcome(total=len(tests), skipped=skipped)


def _load_json(path: Path, what: str) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read the {what} {path}: {exc}") from exc


def check(suite: str, report_path: Path, budget_path: Path) -> int:
    """Compare one suite's skipped tests with its budget and print the result.

    Returns:
        0 within budget, ``EXIT_OVER_BUDGET`` over it, ``EXIT_FAIL_CLOSED``
        when the report or the budget cannot be used.
    """
    try:
        outcome = read_outcome(_load_json(report_path, "report"))
        budgets = _load_json(budget_path, "budget file").get("budgets", {})
    except ValueError as exc:
        print(f"skip-budget: FAIL-CLOSED: {exc}")
        return EXIT_FAIL_CLOSED
    if outcome.total == 0:
        print(f"skip-budget: FAIL-CLOSED: {report_path} holds no test")
        return EXIT_FAIL_CLOSED

    print(
        f"skip-budget: {suite}: {outcome.total} tests, {len(outcome.skipped)} skipped"
    )
    for line in outcome.skipped:
        print(f"  skipped: {line}")
    budget = budgets.get(suite)
    if not isinstance(budget, int):
        print(f"skip-budget: FAIL-CLOSED: no budget for {suite!r} in {budget_path}")
        return EXIT_FAIL_CLOSED
    if len(outcome.skipped) > budget:
        print(
            f"skip-budget: OVER - {len(outcome.skipped)} skipped, budget {budget}. A surface "
            "that stopped being reachable reads as a skip; fix the path, or raise the "
            f"budget in {budget_path} in the same commit with the reason."
        )
        return EXIT_OVER_BUDGET
    print(f"skip-budget: OK - within the budget of {budget}")
    if len(outcome.skipped) < budget:
        print(
            f"skip-budget: the budget can drop to {len(outcome.skipped)}; lower it by hand (#2140)"
        )
    return 0


def main(argv: list[str]) -> int:
    """Parse the arguments and run :func:`check`."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--suite", required=True, help="key in the budget file")
    parser.add_argument(
        "--report", required=True, type=Path, help="Playwright JSON report"
    )
    parser.add_argument("--budget", type=Path, default=BUDGET_FILE, help="budget file")
    opts = parser.parse_args(argv)
    return check(opts.suite, opts.report, opts.budget)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
