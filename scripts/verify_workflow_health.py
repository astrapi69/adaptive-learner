#!/usr/bin/env python3
"""Daily red-runs rollup: surface failed scheduled/push workflow runs (#2225).

PR gates are visible because they block a merge. Scheduled and
push-driven runs fail into the void until someone opens the Actions
tab: the 2026-07-31 audit found one nightly gate red for six
consecutive nights (its fifth multi-day streak since June, #1531) and
another killed at its own timeout every night with conclusion
"cancelled" (#2223), for which GitHub sends no failure notification at
all. The #2077 check inventory detects a silently DISABLED check, not
a running one that is red - this script covers that gap.

What it does: for every active workflow, look at the latest COMPLETED
run whose event is `schedule` or `push` within the lookback window and
report it. Any conclusion other than success/skipped/neutral counts as
red (fail closed on unknown conclusions). Dispatch-only workflows
(release drivers, publish-image, ...) are deliberately out of scope: a
human dispatches them and sees the result, and counting their last -
often historical - red would leave this rollup permanently red, which
is as ineffective as never reporting.

This rollup EXCLUDES ITSELF from the counted set. It runs on `schedule`,
so it is an active workflow with its own scheduled runs; once it goes red
because another workflow was red, the next day it would count its own
prior red run and stay red forever - independent of any real finding, the
guard failing at the exact class it exists to prevent. The exclusion is
derived from the run's own identity (`GITHUB_RUN_ID` -> `workflow_id`),
not a name/path match (which breaks silently on a rename), and it is named
in the measured set so a silent exception is never mistaken for an
overlooked workflow.

Each red run is self-attributing (#2430): the rollup prints the head
SHA the nightly measured and the commits since that workflow's OWN last
green run - the candidate causes - so correlating a red with the change
that caused it no longer depends on remembering yesterday's merges. That
enrichment is layered on an already-red verdict and fails open (a printed
note), never flipping the red/green verdict or the exit code.

Honest framing: this replaces scanning the Actions tab with ONE place
to look. It does not make looking unnecessary, and it is NOT a merge
gate.

Gate contract (#2083): fails on any red run; passes on an all-green
set; fails CLOSED when the API is unreachable, the workflow list is
empty, or NO workflow had a schedule/push run in the window; prints
the measured set (repo, window, event filter, per-workflow verdicts).

Exit codes: 0 all green, 1 red runs found or basis broken.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

GREEN_CONCLUSIONS = {"success", "skipped", "neutral"}
COUNTED_EVENTS = {"schedule", "push"}


@dataclass
class WorkflowVerdict:
    """Latest counted run of one workflow, or the absence of one."""

    name: str
    path: str
    conclusion: str | None
    event: str | None
    created_at: str | None
    url: str | None
    workflow_id: int | None = None
    head_sha: str | None = None

    @property
    def is_red(self) -> bool:
        if self.conclusion is None:
            return False
        return self.conclusion not in GREEN_CONCLUSIONS


def gh_api(endpoint: str) -> object:
    """Fetch one GitHub API endpoint via the gh CLI, failing closed.

    Raises:
        RuntimeError: when gh is missing, exits non-zero, or returns
            something that is not JSON - the caller must NOT treat any
            of these as "nothing to report".
    """
    try:
        proc = subprocess.run(
            ["gh", "api", endpoint],
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"gh api {endpoint} could not run: {exc}") from exc
    if proc.returncode != 0:
        raise RuntimeError(
            f"gh api {endpoint} exited {proc.returncode}: {proc.stderr.strip()[:300]}"
        )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"gh api {endpoint} returned non-JSON output") from exc


def resolve_repo(cli_repo: str | None) -> str:
    """Repo slug from --repo, then GITHUB_REPOSITORY, then gh repo view."""
    if cli_repo:
        return cli_repo
    env_repo = os.environ.get("GITHUB_REPOSITORY")
    if env_repo:
        return env_repo
    payload = gh_api("repos/:owner/:repo")
    if isinstance(payload, dict) and payload.get("full_name"):
        return str(payload["full_name"])
    raise RuntimeError("could not resolve the repository (pass --repo owner/name)")


def resolve_self_workflow_id(repo: str) -> int | None:
    """The ``workflow_id`` of the run this script is executing in.

    Derived from ``GITHUB_RUN_ID`` (the run's own identity), NOT from the
    workflow's name or file path, so the self-exclusion in ``main`` survives a
    rename of either - a name/path string match would break silently on a
    rename. Returns ``None`` when there is no run to resolve (local / manual
    invocation) or the lookup fails; the caller then counts every workflow and
    SAYS so. That is the safe direction: including this workflow can only make
    the rollup redder (re-exposing the self-count), never hide another
    workflow's red.
    """
    run_id = os.environ.get("GITHUB_RUN_ID")
    if not run_id:
        return None
    try:
        payload = gh_api(f"repos/{repo}/actions/runs/{run_id}")
    except RuntimeError:
        return None
    if isinstance(payload, dict) and isinstance(payload.get("workflow_id"), int):
        return payload["workflow_id"]
    return None


def list_active_workflows(repo: str) -> list[dict]:
    """All active, file-backed workflows (drops dynamic/ dependabot entries)."""
    payload = gh_api(f"repos/{repo}/actions/workflows?per_page=100")
    if not isinstance(payload, dict) or "workflows" not in payload:
        raise RuntimeError("unexpected workflows payload shape")
    return [
        w
        for w in payload["workflows"]
        if w.get("state") == "active"
        and str(w.get("path", "")).startswith(".github/workflows/")
    ]


def latest_counted_run(repo: str, workflow: dict, cutoff: datetime) -> WorkflowVerdict:
    """Newest completed schedule/push run inside the window, if any."""
    runs_payload = gh_api(
        f"repos/{repo}/actions/workflows/{workflow['id']}/runs"
        "?status=completed&per_page=30"
    )
    if not isinstance(runs_payload, dict) or "workflow_runs" not in runs_payload:
        raise RuntimeError(f"unexpected runs payload for {workflow['path']}")
    for run in runs_payload["workflow_runs"]:
        if run.get("event") not in COUNTED_EVENTS:
            continue
        created = datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))
        if created < cutoff:
            break
        return WorkflowVerdict(
            name=workflow["name"],
            path=workflow["path"],
            conclusion=run.get("conclusion") or "unknown",
            event=run["event"],
            created_at=run["created_at"],
            url=run.get("html_url"),
            workflow_id=workflow["id"],
            head_sha=run.get("head_sha"),
        )
    return WorkflowVerdict(
        name=workflow["name"],
        path=workflow["path"],
        conclusion=None,
        event=None,
        created_at=None,
        url=None,
        workflow_id=workflow["id"],
        head_sha=None,
    )


def last_green_run(repo: str, workflow_id: int) -> tuple[str, str] | None:
    """``(head_sha, created_at)`` of a workflow's most recent successful run.

    Queries the ``status=success`` conclusion filter, newest first, so the
    range printed for a red run is measured against that workflow's OWN last
    green - the candidate-cause window, not develop's tip. Returns ``None``
    when the workflow has never gone green (the whole history is then the
    candidate set). Raises ``RuntimeError`` on an API/parse failure so the
    caller can degrade the enrichment without touching the red verdict.
    """
    payload = gh_api(
        f"repos/{repo}/actions/workflows/{workflow_id}/runs"
        "?status=success&per_page=1"
    )
    if not isinstance(payload, dict) or "workflow_runs" not in payload:
        raise RuntimeError(f"unexpected success-runs payload for workflow {workflow_id}")
    runs = payload["workflow_runs"]
    if not runs:
        return None
    run = runs[0]
    head_sha = run.get("head_sha")
    if not head_sha:
        raise RuntimeError(f"success run for workflow {workflow_id} carried no head_sha")
    return str(head_sha), str(run.get("created_at") or "unknown")


def commits_since(repo: str, base_sha: str, head_sha: str) -> list[tuple[str, str]]:
    """First-line summaries of the commits in ``base_sha..head_sha``.

    Uses the compare API (``base...head``) instead of a local ``git log`` so
    the enrichment does not depend on the rollup's checkout depth - the CI
    job runs it against the live API with no full clone. Raises
    ``RuntimeError`` on an API/parse failure; the caller degrades gracefully.
    """
    payload = gh_api(f"repos/{repo}/compare/{base_sha}...{head_sha}")
    if not isinstance(payload, dict) or "commits" not in payload:
        raise RuntimeError(f"unexpected compare payload for {base_sha}...{head_sha}")
    commits: list[tuple[str, str]] = []
    for commit in payload["commits"]:
        sha = str(commit.get("sha", ""))[:7]
        message = str((commit.get("commit") or {}).get("message") or "")
        summary = message.splitlines()[0] if message else ""
        commits.append((sha, summary))
    return commits


def attribution_lines(repo: str, verdict: WorkflowVerdict) -> list[str]:
    """Self-attribution block for one red verdict (#2430).

    Names the head SHA the nightly measured and the commits since that
    workflow's own last green run - the candidate causes - so a red is
    actionable from the rollup alone, without opening the Actions tab and
    reconstructing the day. This is enrichment on an ALREADY-red verdict:
    every failure path degrades to a printed note and NEVER changes the
    red/green verdict or the exit code (a diagnostic that fails open, layered
    on a gate that has already failed closed).
    """
    lines = [f"  attribution {verdict.path}:"]
    lines.append(f"    measured head_sha={verdict.head_sha or 'unknown'}")
    if verdict.workflow_id is None or not verdict.head_sha:
        lines.append("    attribution unavailable: run carried no workflow id or head sha")
        return lines
    try:
        green = last_green_run(repo, verdict.workflow_id)
    except RuntimeError as exc:
        lines.append(f"    attribution unavailable: last-green lookup failed ({exc})")
        return lines
    if green is None:
        lines.append("    no prior successful run - the full history is the candidate set")
        return lines
    base_sha, base_created = green
    lines.append(f"    last green run: {base_created} sha={base_sha}")
    try:
        commits = commits_since(repo, base_sha, verdict.head_sha)
    except RuntimeError as exc:
        lines.append(f"    commit range unavailable: compare failed ({exc})")
        return lines
    lines.append(f"    commits since last green ({len(commits)}):")
    for sha, summary in commits:
        lines.append(f"      {sha} {summary}".rstrip())
    return lines


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", help="owner/name (default: GITHUB_REPOSITORY)")
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=10,
        help="lookback window for schedule/push runs (default 10)",
    )
    args = parser.parse_args()

    try:
        repo = resolve_repo(args.repo)
        workflows = list_active_workflows(repo)
        if not workflows:
            print("FAIL red-runs-rollup: zero active workflows returned - "
                  "an empty set is not a clean one.")
            return 1
        self_workflow_id = resolve_self_workflow_id(repo)
        counted_workflows = [w for w in workflows if w.get("id") != self_workflow_id]
        excluded_self = [w for w in workflows if w.get("id") == self_workflow_id]
        cutoff = datetime.now(UTC) - timedelta(days=args.max_age_days)
        verdicts = [latest_counted_run(repo, w, cutoff) for w in counted_workflows]
    except RuntimeError as exc:
        print(f"FAIL red-runs-rollup (fail closed): {exc}")
        return 1

    counted = [v for v in verdicts if v.conclusion is not None]
    reds = [v for v in counted if v.is_red]
    quiet = [v for v in verdicts if v.conclusion is None]

    print(
        f"red-runs-rollup: repo={repo} window={args.max_age_days}d "
        f"events={sorted(COUNTED_EVENTS)}"
    )
    if excluded_self:
        print(f"  self {excluded_self[0]['path']} excluded (own run's workflow "
              f"id={self_workflow_id}) - a rollup that counts its own prior red "
              f"stays red forever")
    elif self_workflow_id is not None:
        print(f"  self workflow id={self_workflow_id} excluded (not in the "
              f"active-workflow list)")
    else:
        print("  note: self-workflow exclusion unavailable (no GITHUB_RUN_ID or "
              "run lookup failed); counting every workflow including this one")
    for v in sorted(counted, key=lambda x: (not x.is_red, x.path)):
        marker = "RED " if v.is_red else "ok  "
        print(f"  {marker} {v.conclusion:<16} {v.event:<8} {v.created_at}  "
              f"{v.path}  {v.url if v.is_red else ''}".rstrip())
    for v in sorted(quiet, key=lambda x: x.path):
        print(f"  --   no schedule/push run in window       {v.path}")
    print(
        f"checked {len(workflows)} active workflows "
        f"({len(excluded_self)} self excluded): {len(counted)} with a "
        f"schedule/push run in the last {args.max_age_days} days, "
        f"{len(reds)} red, {len(quiet)} without a counted run."
    )

    if not counted:
        print("FAIL red-runs-rollup: no workflow had any schedule/push run in "
              "the window - the night shift did not run at all (fail closed).")
        return 1
    if reds:
        for verdict in sorted(reds, key=lambda x: x.path):
            for line in attribution_lines(repo, verdict):
                print(line)
        print("FAIL red-runs-rollup: red scheduled/push runs found. Each one "
              "is either a real finding, a broken tool, an environment flake, "
              "or an obsolete check - classify and act, do not mute.")
        return 1
    print("OK red-runs-rollup: every counted workflow's latest "
          "schedule/push run is green.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
