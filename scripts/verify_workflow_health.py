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
        )
    return WorkflowVerdict(
        name=workflow["name"],
        path=workflow["path"],
        conclusion=None,
        event=None,
        created_at=None,
        url=None,
    )


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
        cutoff = datetime.now(UTC) - timedelta(days=args.max_age_days)
        verdicts = [latest_counted_run(repo, w, cutoff) for w in workflows]
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
    for v in sorted(counted, key=lambda x: (not x.is_red, x.path)):
        marker = "RED " if v.is_red else "ok  "
        print(f"  {marker} {v.conclusion:<16} {v.event:<8} {v.created_at}  "
              f"{v.path}  {v.url if v.is_red else ''}".rstrip())
    for v in sorted(quiet, key=lambda x: x.path):
        print(f"  --   no schedule/push run in window       {v.path}")
    print(
        f"checked {len(workflows)} active workflows: {len(counted)} with a "
        f"schedule/push run in the last {args.max_age_days} days, "
        f"{len(reds)} red, {len(quiet)} without a counted run."
    )

    if not counted:
        print("FAIL red-runs-rollup: no workflow had any schedule/push run in "
              "the window - the night shift did not run at all (fail closed).")
        return 1
    if reds:
        print("FAIL red-runs-rollup: red scheduled/push runs found. Each one "
              "is either a real finding, a broken tool, an environment flake, "
              "or an obsolete check - classify and act, do not mute.")
        return 1
    print("OK red-runs-rollup: every counted workflow's latest "
          "schedule/push run is green.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
