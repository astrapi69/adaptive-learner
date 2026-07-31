"""Gate contract tests for the red-runs rollup (#2225, contract #2083).

The script is exercised through its real interface - a subprocess that
shells out to ``gh api`` - with a stub ``gh`` executable on PATH
serving fixture JSON (lessons/core.md "Test a tool through the
interface it actually uses"). The five contract points:

1. it detects the violation (a red scheduled run fails it),
2. it passes on a clean set,
3. it fails CLOSED when its basis is broken (API error, zero
   workflows, no counted runs at all),
4. it reports WHAT it measured (the checked-set size is asserted),
5. the window and event filter are printed, so the number means the
   same thing everywhere.
"""

from __future__ import annotations

import json
import os
import stat
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "verify_workflow_health.py"

GH_STUB = """#!/usr/bin/env bash
# Serves fixture JSON for `gh api <endpoint>` from GH_STUB_DIR.
set -u
if [ "${GH_STUB_FAIL:-}" = "1" ]; then
  echo "HTTP 500 boom" >&2
  exit 1
fi
endpoint="$2"
case "$endpoint" in
  *"/actions/workflows?"*) cat "$GH_STUB_DIR/workflows.json" ;;
  *"/actions/workflows/"*)
    wf_id=$(printf '%s' "$endpoint" | sed -E 's|.*/workflows/([0-9]+)/runs.*|\\1|')
    cat "$GH_STUB_DIR/runs_${wf_id}.json" ;;
  *) exit 1 ;;
esac
"""


def _recent(hours_ago: int) -> str:
    stamp = datetime.now(UTC) - timedelta(hours=hours_ago)
    return stamp.strftime("%Y-%m-%dT%H:%M:%SZ")


def _workflow(wf_id: int, name: str, filename: str) -> dict:
    return {
        "id": wf_id,
        "name": name,
        "path": f".github/workflows/{filename}",
        "state": "active",
    }


def _run(event: str, conclusion: str, hours_ago: int = 5) -> dict:
    return {
        "event": event,
        "conclusion": conclusion,
        "created_at": _recent(hours_ago),
        "html_url": f"https://example.test/run/{event}/{conclusion}",
    }


def _invoke(tmp_path: Path, workflows: list[dict], runs: dict[int, list[dict]],
            gh_fail: bool = False) -> subprocess.CompletedProcess:
    stub_dir = tmp_path / "stub"
    stub_dir.mkdir(exist_ok=True)
    (stub_dir / "workflows.json").write_text(json.dumps({"workflows": workflows}))
    for wf_id, wf_runs in runs.items():
        (stub_dir / f"runs_{wf_id}.json").write_text(
            json.dumps({"workflow_runs": wf_runs})
        )
    gh_path = stub_dir / "gh"
    gh_path.write_text(GH_STUB)
    gh_path.chmod(gh_path.stat().st_mode | stat.S_IEXEC)
    env = os.environ.copy()
    env["PATH"] = f"{stub_dir}:{env['PATH']}"
    env["GH_STUB_DIR"] = str(stub_dir)
    env["GITHUB_REPOSITORY"] = "stub/repo"
    if gh_fail:
        env["GH_STUB_FAIL"] = "1"
    return subprocess.run(
        ["python3", str(SCRIPT)],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


def test_rollup_fails_when_latest_scheduled_run_is_red(tmp_path: Path) -> None:
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml"), _workflow(2, "Push", "push.yml")],
        {1: [_run("schedule", "failure")], 2: [_run("push", "success")]},
    )
    assert result.returncode == 1
    assert "RED " in result.stdout
    assert "nightly.yml" in result.stdout


def test_rollup_passes_when_all_counted_runs_are_green(tmp_path: Path) -> None:
    result = _invoke(
        tmp_path,
        [
            _workflow(1, "Nightly", "nightly.yml"),
            _workflow(2, "Dispatch only", "release-driver.yml"),
        ],
        {
            1: [_run("schedule", "success")],
            # Dispatch-only workflow: its historical red must NOT count.
            2: [_run("workflow_dispatch", "failure")],
        },
    )
    assert result.returncode == 0, result.stdout
    assert "OK red-runs-rollup" in result.stdout
    assert "no schedule/push run in window" in result.stdout


def test_rollup_counts_cancelled_as_red_when_it_is_the_latest_run(
    tmp_path: Path,
) -> None:
    result = _invoke(
        tmp_path,
        [_workflow(1, "Mutation", "mutation.yml")],
        {1: [_run("schedule", "cancelled")]},
    )
    assert result.returncode == 1
    assert "cancelled" in result.stdout


def test_rollup_ignores_red_runs_older_than_the_window(tmp_path: Path) -> None:
    result = _invoke(
        tmp_path,
        [
            _workflow(1, "Stale red", "stale.yml"),
            _workflow(2, "Fresh green", "fresh.yml"),
        ],
        {
            1: [_run("schedule", "failure", hours_ago=24 * 30)],
            2: [_run("schedule", "success")],
        },
    )
    assert result.returncode == 0, result.stdout


def test_rollup_fails_closed_when_the_api_errors(tmp_path: Path) -> None:
    result = _invoke(tmp_path, [], {}, gh_fail=True)
    assert result.returncode == 1
    assert "fail closed" in result.stdout


def test_rollup_fails_closed_when_zero_workflows_are_returned(
    tmp_path: Path,
) -> None:
    result = _invoke(tmp_path, [], {})
    assert result.returncode == 1
    assert "zero active workflows" in result.stdout


def test_rollup_fails_closed_when_no_workflow_had_a_counted_run(
    tmp_path: Path,
) -> None:
    result = _invoke(
        tmp_path,
        [_workflow(1, "Dispatch only", "driver.yml")],
        {1: [_run("workflow_dispatch", "success")]},
    )
    assert result.returncode == 1
    assert "night shift did not run at all" in result.stdout


def test_rollup_reports_the_measured_set(tmp_path: Path) -> None:
    result = _invoke(
        tmp_path,
        [_workflow(1, "A", "a.yml"), _workflow(2, "B", "b.yml")],
        {1: [_run("schedule", "success")], 2: [_run("push", "success")]},
    )
    assert result.returncode == 0
    assert "checked 2 active workflows" in result.stdout
    assert "window=10d" in result.stdout
    assert "events=['push', 'schedule']" in result.stdout
