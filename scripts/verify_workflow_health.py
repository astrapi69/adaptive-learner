#!/usr/bin/env python3
"""Red-runs rollup: two modes over one workflow-health question (#2225, #2447).

PR gates are visible because they block a merge. Scheduled and
push-driven runs fail into the void until someone opens the Actions
tab: the 2026-07-31 audit found one nightly gate red for six
consecutive nights (its fifth multi-day streak since June, #1531) and
another killed at its own timeout every night with conclusion
"cancelled" (#2223), for which GitHub sends no failure notification at
all. The #2077 check inventory detects a silently DISABLED check, not
a running one that is red - this script covers that gap.

Two modes, split on the triggering event (#2447):

WATCHER (`schedule` / `push`, the default): for every active workflow,
look at the latest COMPLETED run whose event is `schedule` or `push`
within the lookback window and report it. Any conclusion other than
success/skipped/neutral counts as red (fail closed on unknown
conclusions). It answers "what did each workflow's last SCHEDULED run
conclude?" - a statement from yesterday for a nightly. Manual dispatches
NEVER count as evidence here: otherwise anyone could clear a red by
dispatching until it passes, and the guard would stop measuring the
branch's state and start measuring whether someone forced a green run.

TOOL (`workflow_dispatch`): actually TRIGGER the affected workflows,
wait for their result, and report the state NOW - measured, not looked
up. A manual dispatch is fine here because the tool is explicitly asked
about now. Default scope is the workflows the watcher last had red (the
smallest useful set - the visual diff alone is ~18 min); override with
`--trigger`.

The hard separation (#2447): a tool-mode result NEVER feeds the
watcher's judgment. The tool triggers via `workflow_dispatch`, an event
the watcher's ``COUNTED_EVENTS`` never includes - enforced by a
module-level assertion so a later edit cannot silently let the two sets
overlap. A tool-mode green therefore can never turn a watcher red green.

This rollup EXCLUDES ITSELF from the counted set. It runs on `schedule`,
so it is an active workflow with its own scheduled runs; once it goes red
because another workflow was red, the next day it would count its own
prior red run and stay red forever - the guard failing at the exact class
it exists to prevent. The exclusion is derived from the run's own identity
(`GITHUB_RUN_ID` -> `workflow_id`), not a name/path match (which breaks
silently on a rename), and it is named in the measured set so a silent
exception is never mistaken for an overlooked workflow.

Each red run is self-attributing (#2430): the rollup prints the head SHA
the nightly measured and the commits since that workflow's OWN last green
run - the candidate causes. The watcher summary line now also says, per
red, whether it is STALE (a newer successful run on a newer state exists)
or a FRESH finding (#2447): the verdict stays red, but one line tells you
which kind. More information, not less strictness.

Honest framing: this replaces scanning the Actions tab with ONE place
to look. It does not make looking unnecessary, and it is NOT a merge
gate.

Gate contract (#2083): fails on any red run; passes on an all-green
set; fails CLOSED when the API is unreachable, the workflow list is
empty, or NO workflow had a schedule/push run in the window; prints the
measured set (repo, window, event filter, per-workflow verdicts). The
tool mode prints per workflow whether it was RUN this time or only
LOOKED-UP, names the workflows it could not trigger instead of dropping
them, and reports its own runtime so the cost is visible.

Exit codes: 0 all green, 1 red runs found or basis broken.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

GREEN_CONCLUSIONS = {"success", "skipped", "neutral"}
COUNTED_EVENTS = {"schedule", "push"}
TOOL_TRIGGER_EVENT = "workflow_dispatch"

# The hard separation (#2447): the event the TOOL mode fires to obtain a
# fresh result is never an event the WATCHER counts. A tool-mode green can
# therefore never turn a watcher red green - the watcher only ever reads
# schedule/push runs. Asserted at import so a later edit cannot silently let
# the two sets overlap and re-open the "a manual dispatch clears a red" hole.
assert TOOL_TRIGGER_EVENT not in COUNTED_EVENTS, (
    "tool-mode trigger event must never be a counted watcher event"
)


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


@dataclass
class WatchData:
    """The shared read both modes build on: last counted run per workflow."""

    workflows: list[dict]
    counted_workflows: list[dict]
    excluded_self: list[dict]
    self_workflow_id: int | None
    verdicts: list[WorkflowVerdict]


@dataclass
class ToolResult:
    """One workflow's outcome in tool mode: freshly RAN, or only LOOKED-UP."""

    path: str
    ran: bool
    conclusion: str | None
    url: str | None
    note: str = ""

    @property
    def is_red(self) -> bool:
        # A workflow we could not resolve (timeout / no counted run) is red:
        # the tool must not report green over a state it could not measure.
        if self.conclusion is None:
            return True
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


def dispatch_workflow(repo: str, workflow_id: int, ref: str) -> None:
    """POST a ``workflow_dispatch`` for one workflow (tool mode).

    Raises RuntimeError on any non-2xx; the caller classifies the "no
    workflow_dispatch trigger" 422 as not-triggerable and re-raises the rest.
    """
    try:
        proc = subprocess.run(
            [
                "gh",
                "api",
                "-X",
                "POST",
                f"repos/{repo}/actions/workflows/{workflow_id}/dispatches",
                "-f",
                f"ref={ref}",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"dispatch of workflow {workflow_id} could not run: {exc}") from exc
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip()[:300] or f"dispatch exited {proc.returncode}")


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
    workflow's name or file path, so the self-exclusion in ``run_watch``
    survives a rename of either - a name/path string match would break
    silently on a rename. Returns ``None`` when there is no run to resolve
    (local / manual invocation) or the lookup fails; the caller then counts
    every workflow and SAYS so. That is the safe direction: including this
    workflow can only make the rollup redder (re-exposing the self-count),
    never hide another workflow's red.
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

    Queries the ``status=success`` conclusion filter, newest first (ANY
    event), so the range printed for a red run is measured against that
    workflow's OWN last green - the candidate-cause window, not develop's
    tip. Returns ``None`` when the workflow has never gone green (the whole
    history is then the candidate set). Raises ``RuntimeError`` on an
    API/parse failure so the caller can degrade without touching the verdict.
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


def red_staleness(repo: str, verdict: WorkflowVerdict) -> str:
    """Classify a red as ``stale`` / ``fresh`` / ``unverified`` (#2447).

    STALE: a successful run newer than this red's measured run exists (the
    code has since gone green, the red is a cadence artifact). FRESH: no
    newer green (or the workflow has never gone green) - a real finding.
    UNVERIFIED: the last-green lookup could not run - never claimed stale on
    a failed lookup, so the classification can only under-claim stale, never
    over-claim it (the safe direction, exactly like the verdict itself).
    """
    if verdict.workflow_id is None or verdict.created_at is None:
        return "unverified"
    try:
        green = last_green_run(repo, verdict.workflow_id)
    except RuntimeError:
        return "unverified"
    if green is None:
        return "fresh"
    _, green_created = green
    return "stale" if green_created > verdict.created_at else "fresh"


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
    actionable from the rollup alone. Enrichment on an ALREADY-red verdict:
    every failure path degrades to a printed note and NEVER changes the
    red/green verdict or the exit code.
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


def gather(repo: str, max_age_days: int) -> WatchData:
    """The read both modes share: the last counted run per active workflow.

    Excludes the rollup's own workflow and raises (fail closed) when the
    active-workflow list is empty. Does NOT trigger anything - reading only.
    """
    workflows = list_active_workflows(repo)
    if not workflows:
        raise RuntimeError(
            "zero active workflows returned - an empty set is not a clean one."
        )
    self_workflow_id = resolve_self_workflow_id(repo)
    counted_workflows = [w for w in workflows if w.get("id") != self_workflow_id]
    excluded_self = [w for w in workflows if w.get("id") == self_workflow_id]
    cutoff = datetime.now(UTC) - timedelta(days=max_age_days)
    verdicts = [latest_counted_run(repo, w, cutoff) for w in counted_workflows]
    return WatchData(
        workflows=workflows,
        counted_workflows=counted_workflows,
        excluded_self=excluded_self,
        self_workflow_id=self_workflow_id,
        verdicts=verdicts,
    )


def _print_self_exclusion(data: WatchData) -> None:
    if data.excluded_self:
        print(
            f"  self {data.excluded_self[0]['path']} excluded (own run's workflow "
            f"id={data.self_workflow_id}) - a rollup that counts its own prior red "
            f"stays red forever"
        )
    elif data.self_workflow_id is not None:
        print(
            f"  self workflow id={data.self_workflow_id} excluded (not in the "
            f"active-workflow list)"
        )
    else:
        print(
            "  note: self-workflow exclusion unavailable (no GITHUB_RUN_ID or "
            "run lookup failed); counting every workflow including this one"
        )


def run_watch(repo: str, args: argparse.Namespace) -> int:
    """WATCHER mode: read the last schedule/push run per workflow and judge.

    Triggers NOTHING - it only reads. A manual dispatch of another workflow
    is invisible here because ``latest_counted_run`` filters to
    ``COUNTED_EVENTS``; that is the hard separation, from the watcher's side.
    """
    try:
        data = gather(repo, args.max_age_days)
    except RuntimeError as exc:
        print(f"FAIL red-runs-rollup (fail closed): {exc}")
        return 1

    counted = [v for v in data.verdicts if v.conclusion is not None]
    reds = [v for v in counted if v.is_red]
    quiet = [v for v in data.verdicts if v.conclusion is None]
    tags = [red_staleness(repo, v) for v in reds]

    print(
        f"red-runs-rollup: repo={repo} window={args.max_age_days}d "
        f"events={sorted(COUNTED_EVENTS)}"
    )
    _print_self_exclusion(data)
    for v in sorted(counted, key=lambda x: (not x.is_red, x.path)):
        marker = "RED " if v.is_red else "ok  "
        print(
            f"  {marker} {v.conclusion:<16} {v.event:<8} {v.created_at}  "
            f"{v.path}  {v.url if v.is_red else ''}".rstrip()
        )
    for v in sorted(quiet, key=lambda x: x.path):
        print(f"  --   no schedule/push run in window       {v.path}")

    red_clause = ""
    if reds:
        buckets = []
        if tags.count("stale"):
            buckets.append(f"{tags.count('stale')} stale - a newer successful run exists")
        if tags.count("fresh"):
            buckets.append(f"{tags.count('fresh')} fresh finding(s)")
        if tags.count("unverified"):
            buckets.append(f"{tags.count('unverified')} unverified")
        red_clause = f" ({', '.join(buckets)})"
    print(
        f"checked {len(data.workflows)} active workflows "
        f"({len(data.excluded_self)} self excluded): {len(counted)} with a "
        f"schedule/push run in the last {args.max_age_days} days, "
        f"{len(reds)} red{red_clause}, {len(quiet)} without a counted run."
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


def select_scope(
    counted_workflows: list[dict],
    verdicts: list[WorkflowVerdict],
    trigger_arg: str | None,
) -> list[dict]:
    """Which workflows the tool mode should re-measure now.

    Default (``trigger_arg`` is None): the workflows the watcher last had
    RED - the smallest useful set, since the reason to reach for the tool is
    "is that red gone now?". ``all``: every workflow with a counted run.
    Otherwise a comma list of paths or filenames. Self is already absent
    (``counted_workflows`` excludes it), so the tool never triggers itself.
    """
    red_paths = {v.path for v in verdicts if v.is_red}
    if trigger_arg is None:
        return [w for w in counted_workflows if w["path"] in red_paths]
    if trigger_arg.strip().lower() == "all":
        measured = {v.path for v in verdicts if v.conclusion is not None}
        return [w for w in counted_workflows if w["path"] in measured]
    wanted = {t.strip() for t in trigger_arg.split(",") if t.strip()}
    return [
        w
        for w in counted_workflows
        if w["path"] in wanted or w["path"].split("/")[-1] in wanted
    ]


def wait_for_dispatch_run(
    repo: str,
    workflow: dict,
    since: datetime,
    poll_interval: float,
    timeout: float,
) -> WorkflowVerdict | None:
    """Poll for the ``workflow_dispatch`` run created at/after ``since``.

    Returns its verdict once completed, or ``None`` on timeout. Only counts
    runs whose event is ``workflow_dispatch`` (never the watcher's counted
    events), so a race with a concurrent scheduled run cannot be mistaken for
    the one we triggered.
    """
    deadline = time.monotonic() + timeout
    while True:
        payload = gh_api(
            f"repos/{repo}/actions/workflows/{workflow['id']}/runs"
            f"?event={TOOL_TRIGGER_EVENT}&per_page=10"
        )
        runs = payload.get("workflow_runs", []) if isinstance(payload, dict) else []
        candidate = None
        for run in runs:
            created_raw = run.get("created_at")
            if not created_raw:
                continue
            created = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
            if created >= since:
                candidate = run
                break
        if candidate is not None and candidate.get("status") == "completed":
            return WorkflowVerdict(
                name=workflow["name"],
                path=workflow["path"],
                conclusion=candidate.get("conclusion") or "unknown",
                event=TOOL_TRIGGER_EVENT,
                created_at=candidate.get("created_at"),
                url=candidate.get("html_url"),
                workflow_id=workflow["id"],
                head_sha=candidate.get("head_sha"),
            )
        if time.monotonic() >= deadline:
            return None
        time.sleep(poll_interval)


def measure_one(
    repo: str,
    workflow: dict,
    verdict: WorkflowVerdict | None,
    args: argparse.Namespace,
) -> ToolResult:
    """Trigger one workflow and wait for its fresh result, or look it up.

    A workflow without a ``workflow_dispatch`` trigger cannot be run on
    demand: it is reported as LOOKED-UP with its last counted verdict and a
    reason, never silently dropped (the looked-up-dressed-as-fresh class).
    """
    since = datetime.now(UTC)
    try:
        dispatch_workflow(repo, workflow["id"], args.ref)
    except RuntimeError as exc:
        if "workflow_dispatch" in str(exc).lower() or "does not have" in str(exc).lower():
            return ToolResult(
                path=workflow["path"],
                ran=False,
                conclusion=verdict.conclusion if verdict else None,
                url=verdict.url if verdict else None,
                note="not manually triggerable (no workflow_dispatch trigger)",
            )
        raise
    fresh = wait_for_dispatch_run(
        repo, workflow, since, args.poll_interval, args.tool_timeout
    )
    if fresh is None:
        return ToolResult(
            path=workflow["path"],
            ran=True,
            conclusion=None,
            url=None,
            note=f"timed out after {args.tool_timeout:.0f}s waiting for the triggered run",
        )
    return ToolResult(
        path=workflow["path"],
        ran=True,
        conclusion=fresh.conclusion,
        url=fresh.url,
    )


def run_tool(repo: str, args: argparse.Namespace) -> int:
    """TOOL mode: trigger the affected workflows, wait, report the now-state.

    The results are a SEPARATE report; they never feed the watcher (the tool
    triggers via ``workflow_dispatch``, which the watcher never counts). The
    tool's own verdict is over the FRESH results it measured plus any red it
    could only look up.
    """
    started = time.monotonic()
    try:
        data = gather(repo, args.max_age_days)
    except RuntimeError as exc:
        print(f"FAIL red-runs-rollup [tool] (fail closed): {exc}")
        return 1

    counted = [v for v in data.verdicts if v.conclusion is not None]
    scope = select_scope(data.counted_workflows, data.verdicts, args.trigger)
    verdict_by_path = {v.path: v for v in data.verdicts}

    print(
        f"red-runs-rollup [tool mode]: repo={repo} ref={args.ref} - "
        f"triggering + measuring now"
    )
    _print_self_exclusion(data)

    if not counted:
        print("FAIL red-runs-rollup [tool]: no workflow had any schedule/push "
              "run in the window - the night shift did not run at all (fail closed).")
        return 1
    if not scope:
        source = "no --trigger given" if args.trigger is None else f"--trigger={args.trigger}"
        print(f"  scope is empty ({source}): no workflow selected to re-measure.")
        print(f"  checked {len(counted)} workflow(s) in the watcher read; none red.")
        print("OK red-runs-rollup [tool]: nothing to re-measure now; the "
              "watcher's last scheduled state is all green.")
        return 0

    print(f"  scope: {len(scope)} workflow(s) "
          f"({'last red' if args.trigger is None else args.trigger})")
    results = [
        measure_one(repo, w, verdict_by_path.get(w["path"]), args) for w in scope
    ]

    for result in sorted(results, key=lambda r: (not r.is_red, r.path)):
        kind = "RAN      " if result.ran else "looked-up"
        conclusion = result.conclusion or "unresolved"
        marker = "RED " if result.is_red else "ok  "
        note = f"  ({result.note})" if result.note else ""
        url = f"  {result.url}" if result.url and result.is_red else ""
        print(f"  {marker} {kind} {conclusion:<12} {result.path}{url}{note}")

    ran = [r for r in results if r.ran]
    looked_up = [r for r in results if not r.ran]
    reds_now = [r for r in results if r.is_red]
    elapsed = time.monotonic() - started
    print(
        f"tool-mode measured {len(results)} workflow(s): {len(ran)} run fresh, "
        f"{len(looked_up)} looked up (not triggerable); {len(reds_now)} red now. "
        f"runtime {elapsed:.0f}s."
    )
    if reds_now:
        print("FAIL red-runs-rollup [tool]: a re-measured workflow is red NOW. "
              "This is a fresh measurement, not a looked-up nightly - act on it.")
        return 1
    print("OK red-runs-rollup [tool]: every re-measured workflow is green now.")
    return 0


def resolve_mode(cli_mode: str) -> str:
    """``watch`` or ``tool``, from --mode, else the triggering event (#2447)."""
    if cli_mode != "auto":
        return cli_mode
    return "tool" if os.environ.get("GITHUB_EVENT_NAME") == TOOL_TRIGGER_EVENT else "watch"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", help="owner/name (default: GITHUB_REPOSITORY)")
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=10,
        help="lookback window for schedule/push runs (default 10)",
    )
    parser.add_argument(
        "--mode",
        choices=["auto", "watch", "tool"],
        default="auto",
        help="auto (default): watch on schedule/push, tool on workflow_dispatch",
    )
    parser.add_argument(
        "--trigger",
        help="tool mode: 'all', or a comma list of workflow paths/filenames; "
        "default is the workflows the watcher last had red",
    )
    parser.add_argument(
        "--ref",
        default=os.environ.get("GITHUB_REF_NAME") or "develop",
        help="tool mode: git ref to dispatch the workflows on (default: "
        "GITHUB_REF_NAME or develop)",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=15.0,
        help="tool mode: seconds between run-status polls (default 15)",
    )
    parser.add_argument(
        "--tool-timeout",
        type=float,
        default=1800.0,
        help="tool mode: seconds to wait for a triggered run (default 1800)",
    )
    args = parser.parse_args()

    try:
        repo = resolve_repo(args.repo)
    except RuntimeError as exc:
        print(f"FAIL red-runs-rollup (fail closed): {exc}")
        return 1

    if resolve_mode(args.mode) == "tool":
        return run_tool(repo, args)
    return run_watch(repo, args)


if __name__ == "__main__":
    sys.exit(main())
