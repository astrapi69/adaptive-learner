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
  *"/compare/"*) cat "$GH_STUB_DIR/compare.json" ;;
  *"/actions/runs/"*) cat "$GH_STUB_DIR/run.json" ;;
  *"/actions/workflows?"*) cat "$GH_STUB_DIR/workflows.json" ;;
  *"status=success"*)
    wf_id=$(printf '%s' "$endpoint" | sed -E 's|.*/workflows/([0-9]+)/runs.*|\\1|')
    cat "$GH_STUB_DIR/success_${wf_id}.json" ;;
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


def _run(event: str, conclusion: str, hours_ago: int = 5,
         head_sha: str | None = None) -> dict:
    run = {
        "event": event,
        "conclusion": conclusion,
        "created_at": _recent(hours_ago),
        "html_url": f"https://example.test/run/{event}/{conclusion}",
    }
    if head_sha is not None:
        run["head_sha"] = head_sha
    return run


def _invoke(tmp_path: Path, workflows: list[dict], runs: dict[int, list[dict]],
            gh_fail: bool = False, self_run_id: int | None = None,
            self_workflow_id: int | None = None,
            success_runs: dict[int, list[dict]] | None = None,
            compare_commits: list[dict] | None = None,
            ) -> subprocess.CompletedProcess:
    stub_dir = tmp_path / "stub"
    stub_dir.mkdir(exist_ok=True)
    (stub_dir / "workflows.json").write_text(json.dumps({"workflows": workflows}))
    for wf_id, wf_runs in runs.items():
        (stub_dir / f"runs_{wf_id}.json").write_text(
            json.dumps({"workflow_runs": wf_runs})
        )
    # Per-workflow last-green lookup (#2430 attribution): status=success query.
    for wf_id, wf_runs in (success_runs or {}).items():
        (stub_dir / f"success_{wf_id}.json").write_text(
            json.dumps({"workflow_runs": wf_runs})
        )
    # Compare API response feeding "commits since last green".
    if compare_commits is not None:
        (stub_dir / "compare.json").write_text(
            json.dumps({"commits": compare_commits})
        )
    # The self-run lookup (GITHUB_RUN_ID -> workflow_id) resolves to this.
    (stub_dir / "run.json").write_text(json.dumps({"workflow_id": self_workflow_id}))
    gh_path = stub_dir / "gh"
    gh_path.write_text(GH_STUB)
    gh_path.chmod(gh_path.stat().st_mode | stat.S_IEXEC)
    env = os.environ.copy()
    env["PATH"] = f"{stub_dir}:{env['PATH']}"
    env["GH_STUB_DIR"] = str(stub_dir)
    env["GITHUB_REPOSITORY"] = "stub/repo"
    # Deterministic: never inherit the CI job's own GITHUB_RUN_ID; the test
    # sets it explicitly only when it wants the self-exclusion path.
    env.pop("GITHUB_RUN_ID", None)
    if self_run_id is not None:
        env["GITHUB_RUN_ID"] = str(self_run_id)
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
    assert "(0 self excluded)" in result.stdout
    assert "window=10d" in result.stdout
    assert "events=['push', 'schedule']" in result.stdout


def test_rollup_excludes_its_own_workflow_so_a_self_only_red_is_green(
    tmp_path: Path,
) -> None:
    """Green when the ONLY red run is the rollup's own prior scheduled run.

    The self-sustaining loop (#2428): once red, the rollup counts its own
    prior red the next day and never recovers. Excluding self - derived
    from GITHUB_RUN_ID -> workflow_id - breaks it. Direction 1 of the
    contract: green when only itself was red.
    """
    result = _invoke(
        tmp_path,
        [
            _workflow(42, "Red-runs rollup", "red-runs-rollup.yml"),
            _workflow(1, "Nightly", "nightly.yml"),
        ],
        {
            42: [_run("schedule", "failure")],  # the rollup's own prior red
            1: [_run("schedule", "success")],
        },
        self_run_id=9001,
        self_workflow_id=42,
    )
    assert result.returncode == 0, result.stdout
    assert "OK red-runs-rollup" in result.stdout
    assert "self .github/workflows/red-runs-rollup.yml excluded" in result.stdout
    assert "(1 self excluded)" in result.stdout
    # self is excluded from the counted set, never listed as a counted red.
    assert result.stdout.count("RED ") == 0


def test_rollup_still_red_when_another_workflow_is_red_despite_self_excluded(
    tmp_path: Path,
) -> None:
    """Red when ANOTHER workflow is red, even though self is red too.

    Direction 2 of the contract: self-exclusion must not mask a real
    finding. Exactly one counted red row (the other workflow); the rollup
    fails.
    """
    result = _invoke(
        tmp_path,
        [
            _workflow(42, "Red-runs rollup", "red-runs-rollup.yml"),
            _workflow(1, "Nightly", "nightly.yml"),
        ],
        {
            42: [_run("schedule", "failure")],
            1: [_run("schedule", "failure")],  # a real other-workflow red
        },
        self_run_id=9001,
        self_workflow_id=42,
    )
    assert result.returncode == 1
    assert "nightly.yml" in result.stdout
    # the other workflow is the ONLY counted red; self is not double-counted.
    assert result.stdout.count("RED ") == 1
    assert "self .github/workflows/red-runs-rollup.yml excluded" in result.stdout


def test_rollup_says_when_self_exclusion_is_unavailable(tmp_path: Path) -> None:
    """No GITHUB_RUN_ID -> exclusion unavailable, said out loud, counts all.

    Fail-open on the self-lookup can only over-report (re-expose the
    self-count), never hide another red - so it is announced, not silent.
    """
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "success")]},
        # no self_run_id -> GITHUB_RUN_ID stays unset
    )
    assert result.returncode == 0, result.stdout
    assert "self-workflow exclusion unavailable" in result.stdout


def test_red_run_attribution_lists_commits_since_last_green(tmp_path: Path) -> None:
    """A red run names its head SHA and the commits since its last green (#2430).

    The whole point of the enrichment: correlate a red with the change that
    caused it from the rollup alone, without opening the Actions tab.
    """
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "failure", head_sha="headsha1234567")]},
        success_runs={
            1: [
                {
                    "head_sha": "greensha7654321",
                    "created_at": _recent(48),
                }
            ]
        },
        compare_commits=[
            {"sha": "aaaaaaa1119999", "commit": {"message": "feat: mobile preamble\n\nbody"}},
            {"sha": "bbbbbbb2228888", "commit": {"message": "fix: drop subtitle"}},
        ],
    )
    assert result.returncode == 1, result.stdout
    assert "attribution .github/workflows/nightly.yml:" in result.stdout
    assert "measured head_sha=headsha1234567" in result.stdout
    assert "last green run:" in result.stdout
    assert "greensha7654321" in result.stdout
    assert "commits since last green (2):" in result.stdout
    assert "aaaaaaa feat: mobile preamble" in result.stdout
    assert "bbbbbbb fix: drop subtitle" in result.stdout


def test_red_run_attribution_degrades_when_no_prior_green(tmp_path: Path) -> None:
    """Attribution never flips the verdict: a missing green run just degrades.

    Enrichment layered on an already-red verdict fails open (a printed note),
    it does not change the red/green outcome or the exit code.
    """
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "failure", head_sha="headsha1234567")]},
        success_runs={1: []},  # workflow has never gone green
    )
    assert result.returncode == 1, result.stdout
    assert "measured head_sha=headsha1234567" in result.stdout
    assert "no prior successful run" in result.stdout
