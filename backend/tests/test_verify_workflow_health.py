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
# Serves fixture JSON for `gh api [-X POST] <endpoint> [-f k=v]` from
# GH_STUB_DIR, and logs every endpoint to calls.log so a test can assert the
# watcher triggered nothing.
set -u
if [ "${GH_STUB_FAIL:-}" = "1" ]; then
  echo "HTTP 500 boom" >&2
  exit 1
fi
# The endpoint is the first arg that looks like a repos/ path, so this works
# whether the call is `gh api <ep>` or `gh api -X POST <ep> -f ref=...`.
endpoint=""
for a in "$@"; do
  case "$a" in repos/*) endpoint="$a"; break;; esac
done
printf '%s\\n' "$endpoint" >> "$GH_STUB_DIR/calls.log"
case "$endpoint" in
  *"/dispatches")
    wf_id=$(printf '%s' "$endpoint" | sed -E 's|.*/workflows/([0-9]+)/dispatches|\\1|')
    if [ -f "$GH_STUB_DIR/nodispatch_${wf_id}" ]; then
      echo "HTTP 422: Workflow does not have 'workflow_dispatch' trigger" >&2
      exit 1
    fi
    exit 0 ;;
  *"event=workflow_dispatch"*)
    wf_id=$(printf '%s' "$endpoint" | sed -E 's|.*/workflows/([0-9]+)/runs.*|\\1|')
    cat "$GH_STUB_DIR/dispatch_run_${wf_id}.json" ;;
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


def _dispatch_run(conclusion: str, head_sha: str | None = None) -> dict:
    """A completed workflow_dispatch run the tool mode waits for.

    ``created_at`` is one hour in the FUTURE so it is always >= the ``since``
    the script captures right before dispatching (the wait matches on
    ``created >= since``); otherwise the second-truncated 'now' could sort
    before ``since`` and the poll would time out.
    """
    run = {
        "event": "workflow_dispatch",
        "status": "completed",
        "conclusion": conclusion,
        "created_at": _recent(-1),
        "html_url": f"https://example.test/dispatch/{conclusion}",
    }
    if head_sha is not None:
        run["head_sha"] = head_sha
    return run


def _invoke(tmp_path: Path, workflows: list[dict], runs: dict[int, list[dict]],
            gh_fail: bool = False, self_run_id: int | None = None,
            self_workflow_id: int | None = None,
            success_runs: dict[int, list[dict]] | None = None,
            compare_commits: list[dict] | None = None,
            dispatch_runs: dict[int, dict] | None = None,
            nodispatch_ids: list[int] | None = None,
            event_name: str | None = None,
            extra_args: list[str] | None = None,
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
    # Tool mode: the fresh workflow_dispatch run the poll returns per workflow.
    for wf_id, run in (dispatch_runs or {}).items():
        (stub_dir / f"dispatch_run_{wf_id}.json").write_text(
            json.dumps({"workflow_runs": [run]})
        )
    # Tool mode: a marker makes the stub's dispatch POST 422 (not triggerable).
    for wf_id in nodispatch_ids or []:
        (stub_dir / f"nodispatch_{wf_id}").write_text("")
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
    # Deterministic: never inherit the CI job's own GITHUB_RUN_ID / event; the
    # test sets them explicitly only when it wants that path.
    env.pop("GITHUB_RUN_ID", None)
    env.pop("GITHUB_EVENT_NAME", None)
    if self_run_id is not None:
        env["GITHUB_RUN_ID"] = str(self_run_id)
    if event_name is not None:
        env["GITHUB_EVENT_NAME"] = event_name
    if gh_fail:
        env["GH_STUB_FAIL"] = "1"
    return subprocess.run(
        ["python3", str(SCRIPT), *(extra_args or [])],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


def _calls(tmp_path: Path) -> str:
    log = tmp_path / "stub" / "calls.log"
    return log.read_text() if log.exists() else ""


# Fast tool-mode knobs so the poll returns on the first read without waiting.
_TOOL_ARGS = ["--mode", "tool", "--ref", "develop",
              "--poll-interval", "0.01", "--tool-timeout", "5"]


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


# --- #2447: the two modes, and the hard separation between them ---------------


def test_watcher_ignores_a_green_dispatch_when_the_scheduled_run_is_red(
    tmp_path: Path,
) -> None:
    """Hard separation, watcher side: a newer GREEN workflow_dispatch run must
    NOT make the workflow's red scheduled run count as green. The watcher only
    ever reads schedule/push, so a manual dispatch is invisible to its verdict.
    """
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {
            1: [
                _run("workflow_dispatch", "success", hours_ago=1),  # newer, green
                _run("schedule", "failure", hours_ago=6),  # older, the real state
            ]
        },
    )
    assert result.returncode == 1, result.stdout
    assert "RED " in result.stdout
    assert "nightly.yml" in result.stdout


def test_watcher_triggers_nothing_it_only_reads(tmp_path: Path) -> None:
    """Hard separation, watcher side: the watcher never dispatches a workflow."""
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "failure")]},
    )
    assert result.returncode == 1
    assert "/dispatches" not in _calls(tmp_path)


def test_watcher_summary_tags_a_stale_red(tmp_path: Path) -> None:
    """A red with a NEWER successful run is tagged 'stale' in the summary line -
    the verdict stays red, but one line says it is a cadence artifact (#2447).
    """
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "failure", hours_ago=6)]},
        success_runs={1: [{"head_sha": "greensha", "created_at": _recent(1)}]},
    )
    assert result.returncode == 1, result.stdout
    assert "1 red (1 stale" in result.stdout


def test_watcher_summary_tags_a_fresh_red(tmp_path: Path) -> None:
    """A red with NO newer successful run is a fresh finding, not stale."""
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "failure", hours_ago=1)]},
        success_runs={1: [{"head_sha": "greensha", "created_at": _recent(48)}]},
    )
    assert result.returncode == 1, result.stdout
    assert "1 red (1 fresh finding" in result.stdout


def test_tool_mode_is_selected_by_the_workflow_dispatch_event(tmp_path: Path) -> None:
    """The mode split is driven by the triggering event: a workflow_dispatch
    invocation (no --mode) runs the tool, not the watcher (#2447)."""
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "failure")]},
        dispatch_runs={1: _dispatch_run("success")},
        event_name="workflow_dispatch",
        extra_args=["--ref", "develop", "--poll-interval", "0.01", "--tool-timeout", "5"],
    )
    assert "[tool mode]" in result.stdout, result.stdout


def test_tool_mode_triggers_the_red_workflow_and_reports_fresh_green(
    tmp_path: Path,
) -> None:
    """Tool mode: the last-red workflow is triggered, its FRESH result reported
    as RAN + green, the runtime shown; the green workflow is NOT triggered."""
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml"), _workflow(2, "Other", "other.yml")],
        {1: [_run("schedule", "failure")], 2: [_run("schedule", "success")]},
        dispatch_runs={1: _dispatch_run("success")},
        extra_args=_TOOL_ARGS,
    )
    assert result.returncode == 0, result.stdout
    assert "[tool mode]" in result.stdout
    assert "RAN" in result.stdout
    assert "runtime" in result.stdout
    assert "every re-measured workflow is green now" in result.stdout
    calls = _calls(tmp_path)
    assert "/workflows/1/dispatches" in calls  # the red one
    assert "/workflows/2/dispatches" not in calls  # the green one is out of scope


def test_tool_mode_reports_a_non_triggerable_workflow_instead_of_dropping_it(
    tmp_path: Path,
) -> None:
    """A workflow without a workflow_dispatch trigger is reported LOOKED-UP with
    a reason, never silently omitted (the looked-up-dressed-as-fresh class)."""
    result = _invoke(
        tmp_path,
        [_workflow(1, "Push only", "push-only.yml")],
        {1: [_run("push", "failure")]},
        nodispatch_ids=[1],
        extra_args=_TOOL_ARGS,
    )
    assert result.returncode == 1, result.stdout
    assert "looked-up" in result.stdout
    assert "not manually triggerable" in result.stdout
    assert "push-only.yml" in result.stdout


def test_tool_mode_labels_ran_vs_looked_up_per_workflow(tmp_path: Path) -> None:
    """Tool mode names, per workflow, whether it was RUN this time or only
    LOOKED-UP - the distinction the report must never blur (#2447)."""
    result = _invoke(
        tmp_path,
        [_workflow(1, "Triggerable", "a.yml"), _workflow(2, "Push only", "b.yml")],
        {1: [_run("schedule", "failure")], 2: [_run("push", "failure")]},
        dispatch_runs={1: _dispatch_run("success")},
        nodispatch_ids=[2],
        extra_args=_TOOL_ARGS,
    )
    assert "RAN" in result.stdout
    assert "looked-up" in result.stdout
    assert "1 run fresh" in result.stdout
    assert "looked up" in result.stdout
    assert result.returncode == 1  # b.yml red, only looked up -> still red


def test_tool_mode_fails_when_a_re_measured_workflow_is_red_now(tmp_path: Path) -> None:
    """A fresh red measured NOW fails the tool - it is not a stale nightly."""
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "failure")]},
        dispatch_runs={1: _dispatch_run("failure")},
        extra_args=_TOOL_ARGS,
    )
    assert result.returncode == 1, result.stdout
    assert "red NOW" in result.stdout


def test_tool_mode_with_no_red_has_nothing_to_re_measure(tmp_path: Path) -> None:
    """Default scope is the last-red set; with no red the tool re-measures
    nothing and says so, without triggering anything."""
    result = _invoke(
        tmp_path,
        [_workflow(1, "Nightly", "nightly.yml")],
        {1: [_run("schedule", "success")]},
        extra_args=_TOOL_ARGS,
    )
    assert result.returncode == 0, result.stdout
    assert "nothing to re-measure" in result.stdout
    assert "/dispatches" not in _calls(tmp_path)
