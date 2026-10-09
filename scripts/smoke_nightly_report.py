#!/usr/bin/env python3
"""Report of the nightly mobile-viewport smoke run (#3544).

The run executes ``e2e/smoke/mobile-viewports.spec.ts`` once a night against
the real backend and the Vite dev server, to catch the intermittent miss
where a page root was absent after navigation at 390 px. It is a night-shift
report, never a merge gate (#575). This script reads Playwright's JSON report
and writes the texts the workflow files in ONE issue.

Usage (in the workflow, after the test step)::

    python3 scripts/smoke_nightly_report.py --report e2e/test-results/smoke-nightly.json \\
        --summary summary.json --body body.md --comment comment.md --run-url <url>

A finding is a test that failed, or failed and passed on its retry: the miss
this run exists for shows as exactly that. Exit codes: 0 measured (findings
or not; the workflow files them), 2 no measurement (no report, a run-level
error such as a server that never started, or no test that ran): a night
that measured nothing must never read as a clean one (gate contract point 3,
#2083).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from check_e2e_skip_budget import walk_tests

EXIT_FAIL_CLOSED = 2

MARKER = "<!-- smoke-nightly-report (#3544) -->"

ANSI = re.compile(r"\x1b\[[0-9;]*m")

OUTCOMES = {"unexpected": "failed", "flaky": "failed, then passed on retry"}

LIMIT = (
    "**What this run cannot see.** It checks function at narrow widths, not "
    "appearance. Per viewport it proves that each route mounts, that the page "
    "does not scroll sideways and that the hamburger menu is there and closed. "
    "It does not see elements overlapping, a toast covering a button, wrong "
    "spacing or poor contrast. A green night means none of those checks broke, "
    "not that the layout is right."
)

WIDENING = (
    "**Widening it.** The run covers `e2e/smoke/mobile-viewports.spec.ts` only "
    "(12 tests, about 83 s measured on 2026-10-09). Running the whole smoke "
    "project (45 tests, about 344 s) is not the next step by default: it is "
    "considered only once this run has produced real findings over several "
    "weeks. A quiet run is no reason to widen it."
)


class ReportBasisError(Exception):
    """The report does not hold a measurement; the night must not read as clean."""


@dataclass(frozen=True)
class Finding:
    """One test that failed, or failed before passing on its retry."""

    title: str
    outcome: str
    error: str


@dataclass(frozen=True)
class Run:
    """What one night measured."""

    total: int
    executed: int
    skipped: int
    findings: list[Finding]


def _first_error_line(test: dict) -> str:
    """The first error Playwright recorded for a test, as one plain line.

    Keeps the headline and, where present, the ``Locator:`` line (which page
    root went missing is the point of the finding); drops the ANSI colours.
    """
    for result in test.get("results", []):
        message = ANSI.sub("", str((result.get("error") or {}).get("message") or "")).strip()
        if not message:
            continue
        lines = message.splitlines()
        locator = next((line for line in lines if line.startswith("Locator: ")), None)
        return f"{lines[0]} ({locator})" if locator else lines[0]
    return "no error message recorded"


def read_run(report: dict) -> Run:
    """Read one night's outcome from a Playwright JSON report.

    Raises:
        ReportBasisError: a run-level error (e.g. a web server that never
            started) or no test that actually ran.
    """
    if report.get("errors"):
        first = str(report["errors"][0].get("message", "unknown error")).strip()
        raise ReportBasisError(
            f"the run itself failed: {first.splitlines()[0] if first else first}"
        )
    tests = [item for suite in report.get("suites", []) for item in walk_tests(suite, ())]
    skipped = sum(1 for _title, test in tests if test.get("status") == "skipped")
    executed = len(tests) - skipped
    if executed == 0:
        raise ReportBasisError(f"no test ran ({len(tests)} in the report, {skipped} skipped)")
    findings = [
        Finding(title.removeprefix("../"), OUTCOMES[test["status"]], _first_error_line(test))
        for title, test in tests
        if test.get("status") in OUTCOMES
    ]
    return Run(total=len(tests), executed=executed, skipped=skipped, findings=findings)


def render_body(run: Run) -> str:
    """The issue body: what the run is, its limit, and when to widen it."""
    return "\n".join(
        [
            "Findings of the nightly mobile-viewport smoke run (#3544). Each night "
            "with a finding adds a comment below; this issue is updated, never "
            "duplicated. A green night changes nothing here: the miss is "
            "intermittent, so a quiet night does not prove it fixed.",
            "",
            f"Last night with a finding: {run.executed} of {run.total} tests ran, "
            f"{len(run.findings)} finding(s).",
            "",
            LIMIT,
            "",
            WIDENING,
            "",
            MARKER,
        ]
    )


def render_comment(run: Run, run_url: str) -> str:
    """One night's findings, with what was measured and where the artifact is."""
    count = len(run.findings)
    lines = [
        f"Nightly run {run_url}: {run.total} tests, {run.executed} run, "
        f"{run.skipped} skipped: {count} finding{'' if count == 1 else 's'}.",
        "",
    ]
    lines += [f"- `{f.title}` ({f.outcome}): {f.error}" for f in run.findings]
    lines += [
        "",
        "Screenshots and the trace of the retry are in the run's `smoke-nightly-report` artifact.",
    ]
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    """Read the report and write the summary and the issue texts."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--report", required=True, type=Path, help="Playwright JSON report")
    parser.add_argument("--summary", required=True, type=Path, help="JSON summary to write")
    parser.add_argument("--body", type=Path, help="issue body to write")
    parser.add_argument("--comment", type=Path, help="issue comment to write")
    parser.add_argument("--run-url", default="", help="URL of this workflow run")
    opts = parser.parse_args(argv)
    try:
        report = json.loads(opts.report.read_text(encoding="utf-8"))
        run = read_run(report)
    except (OSError, json.JSONDecodeError, ReportBasisError) as exc:
        print(f"smoke-nightly: FAIL-CLOSED: {exc}")
        return EXIT_FAIL_CLOSED
    print(
        f"smoke-nightly: {run.total} tests, {run.executed} run, {run.skipped} skipped, "
        f"{len(run.findings)} finding(s)"
    )
    for finding in run.findings:
        print(f"  {finding.outcome}: {finding.title}: {finding.error}")
    summary = {**asdict(run), "findings": len(run.findings)}
    opts.summary.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    if opts.body:
        opts.body.write_text(render_body(run), encoding="utf-8")
    if opts.comment:
        opts.comment.write_text(render_comment(run, opts.run_url), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
