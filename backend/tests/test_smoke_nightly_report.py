"""Tests for the nightly mobile-viewport smoke report (#3544).

The run is a night-shift report, not a merge gate (#575): a measured night
exits 0 and files its findings in one issue; a night that could not measure
exits red and leaves the issue alone. These tests pin what counts as a
finding (a retried-then-green test is one: that is the intermittent miss
the run exists for), the fail-closed paths and the issue text, including
the limit of what a smoke run at narrow widths can see.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))

from smoke_nightly_report import (  # noqa: E402
    EXIT_FAIL_CLOSED,
    MARKER,
    ReportBasisError,
    main,
    read_run,
    render_body,
    render_comment,
)


def _test(status: str, message: str | None = None) -> dict:
    results = [{"status": "failed", "error": {"message": message}}] if message else []
    return {"status": status, "annotations": [], "results": results}


def _report(*tests: tuple[str, dict], errors: list | None = None) -> dict:
    return {
        "errors": errors or [],
        "suites": [
            {
                "title": "mobile-viewports.spec.ts",
                "specs": [{"title": title, "tests": [test]} for title, test in tests],
            }
        ],
    }


GREEN = _report(("Landing", _test("expected")), ("Dashboard", _test("expected")))
MISS = "Error: expect(locator).toBeVisible() failed\n\nLocator: getByTestId('landing')"


def test_a_green_night_has_no_findings() -> None:
    run = read_run(GREEN)
    assert (run.total, run.executed, run.findings) == (2, 2, [])


@pytest.mark.parametrize(
    ("status", "label"),
    [("unexpected", "failed"), ("flaky", "failed, then passed on retry")],
    ids=["failed", "flaky"],
)
def test_a_failed_or_retried_test_is_a_finding(status: str, label: str) -> None:
    run = read_run(_report(("Landing", _test(status, MISS)), ("Dashboard", _test("expected"))))
    assert [(f.title, f.outcome, f.error) for f in run.findings] == [
        (
            "mobile-viewports.spec.ts > Landing",
            label,
            "Error: expect(locator).toBeVisible() failed (Locator: getByTestId('landing'))",
        )
    ]


def test_a_skipped_test_is_counted_but_not_measured() -> None:
    run = read_run(_report(("Landing", _test("skipped")), ("Dashboard", _test("expected"))))
    assert (run.total, run.executed, run.skipped, run.findings) == (2, 1, 1, [])


@pytest.mark.parametrize(
    "report",
    [
        _report(),
        _report(("Landing", _test("skipped"))),
        _report(("Landing", _test("expected")), errors=[{"message": "webServer timed out"}]),
    ],
    ids=["no-tests", "only-skips", "run-level-error"],
)
def test_a_night_without_a_measurement_fails_closed(report: dict) -> None:
    with pytest.raises(ReportBasisError):
        read_run(report)


def test_main_fails_closed_without_a_report(tmp_path: Path) -> None:
    code = main(["--report", str(tmp_path / "missing.json"), "--summary", str(tmp_path / "s.json")])
    assert code == EXIT_FAIL_CLOSED
    assert not (tmp_path / "s.json").exists()


def test_main_writes_the_summary_and_texts(tmp_path: Path) -> None:
    report = tmp_path / "report.json"
    report.write_text(json.dumps(_report(("Landing", _test("flaky", MISS)))), encoding="utf-8")
    code = main(
        [
            "--report",
            str(report),
            "--summary",
            str(tmp_path / "s.json"),
            "--body",
            str(tmp_path / "body.md"),
            "--comment",
            str(tmp_path / "comment.md"),
            "--run-url",
            "https://example.test/run/1",
        ]
    )
    assert code == 0
    summary = json.loads((tmp_path / "s.json").read_text())
    assert (summary["executed"], summary["findings"]) == (1, 1)
    assert MARKER in (tmp_path / "body.md").read_text()
    assert "https://example.test/run/1" in (tmp_path / "comment.md").read_text()


def test_the_issue_body_states_the_limit_and_the_widening_condition() -> None:
    body = render_body(read_run(GREEN))
    assert "not appearance" in body
    assert "overlapping" in body
    assert "real findings over several weeks" in body
    assert body.rstrip().endswith(MARKER)


def test_the_comment_names_each_finding_and_what_was_measured() -> None:
    run = read_run(
        _report(("Landing", _test("unexpected", MISS)), ("Dashboard", _test("expected")))
    )
    comment = render_comment(run, "https://example.test/run/2")
    assert "2 tests, 2 run, 0 skipped: 1 finding" in comment
    assert "`mobile-viewports.spec.ts > Landing` (failed)" in comment


# Copied from the first local run of the spec (2026-10-09): Playwright colours
# the message with ANSI codes and titles the file suite with a relative path.
REAL_MESSAGE = (
    "Error: \x1b[2mexpect(\x1b[22m\x1b[31mlocator\x1b[39m\x1b[2m).\x1b[22mtoBeVisible"
    "\x1b[2m(\x1b[22m\x1b[2m)\x1b[22m failed\n\nLocator: getByTestId('landing')\n"
    "Expected: visible\nTimeout: 5000ms\nError: element(s) not found\n"
)


def test_a_real_report_reads_without_colour_codes_or_path_prefix() -> None:
    report = _report(("Landing renders without horizontal overflow", _test("flaky", REAL_MESSAGE)))
    report["suites"][0]["title"] = "../smoke/mobile-viewports.spec.ts"
    [finding] = read_run(report).findings
    assert (
        finding.title
        == "smoke/mobile-viewports.spec.ts > Landing renders without horizontal overflow"
    )
    assert (
        finding.error
        == "Error: expect(locator).toBeVisible() failed (Locator: getByTestId('landing'))"
    )
