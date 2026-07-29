#!/usr/bin/env python3
"""Refuse to publish from a commit whose checks did not pass (#2145).

``release: created`` fires whether or not the target commit's checks ever
ran. Every release-driven job in this repo published from a commit whose
state it never looked at, inferring "CI was green" from the existence of
a release - a conclusion, not a check.

Publishing deserves the strictest precondition in the project, because it
is the least reversible thing it does: a release asset can be deleted, an
image somebody has already pulled cannot be recalled.

Fail-closed by construction (#2083, #2135):

* a check that has not finished is NOT green - publishing may not race
  the pipeline it is supposed to be gated by;
* an unreadable or absent status is NOT green;
* an EMPTY check list is NOT green. "Nothing to look at" and "nothing
  wrong" print the same success otherwise, which is how this kind of
  guard silently becomes a no-op.

It also reports how many checks it considered and their names, so a
filter that quietly empties the set is visible rather than green.

Usage::

    python3 scripts/verify_release_commit_green.py --sha <sha> \
        --ignore "Publish image (GHCR)"
    gh api ... | python3 scripts/verify_release_commit_green.py --from-json -

Exit codes: 0 green, 1 not green or not readable.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys

# Conclusions that do not block a release. "neutral" and "skipped" are
# normal for path-filtered jobs; everything else (failure, cancelled,
# timed_out, action_required, stale) blocks.
PASSING = {"success", "neutral", "skipped"}


def fetch(sha: str, repo: str | None) -> list[dict] | None:
    """Check runs for exactly this commit, or ``None`` when unreadable."""
    target = f"repos/{repo}/commits/{sha}/check-runs" if repo else f"commits/{sha}/check-runs"
    command = ["gh", "api", "--paginate", target, "--jq", ".check_runs[]"]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    except (OSError, subprocess.SubprocessError) as exc:
        print(f"could not read the check status: {exc}", file=sys.stderr)
        return None
    if result.returncode != 0:
        print(f"could not read the check status: {result.stderr.strip()}", file=sys.stderr)
        return None
    runs: list[dict] = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            runs.append(json.loads(line))
        except json.JSONDecodeError:
            print("could not read the check status: unparsable API response", file=sys.stderr)
            return None
    return runs


def load_json(source: str) -> list[dict] | None:
    raw = sys.stdin.read() if source == "-" else open(source, encoding="utf-8").read()
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"could not read the check status: {exc}", file=sys.stderr)
        return None
    if isinstance(data, dict):
        data = data.get("check_runs", [])
    if not isinstance(data, list):
        print("could not read the check status: expected a list of check runs", file=sys.stderr)
        return None
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sha", help="the commit being published from")
    parser.add_argument("--repo", default=None, help="owner/name (default: the current repo)")
    parser.add_argument("--from-json", default=None, help="read check runs from a file or '-'")
    parser.add_argument(
        "--ignore",
        action="append",
        default=[],
        help="check name to exclude (the publishing run is itself in progress)",
    )
    args = parser.parse_args()

    if args.from_json:
        runs = load_json(args.from_json)
    elif args.sha:
        runs = fetch(args.sha, args.repo)
    else:
        print(
            "could not read the check status: neither --sha nor --from-json given", file=sys.stderr
        )
        return 1
    if runs is None:
        return 1

    considered = [run for run in runs if run.get("name") not in set(args.ignore)]
    names = ", ".join(sorted(str(run.get("name", "?")) for run in considered))
    print(f"release precondition: {len(considered)} check(s) considered")
    if considered:
        print(f"  {names}")
    if args.ignore:
        print(f"  ignored: {', '.join(args.ignore)}")

    if not considered:
        print(
            "no checks found for this commit - refusing to publish.\n"
            "An empty result is not a green result: the commit may never have "
            "been built, or the filter removed everything.",
            file=sys.stderr,
        )
        return 1

    unfinished = [r for r in considered if r.get("status") != "completed"]
    failed = [
        r
        for r in considered
        if r.get("status") == "completed" and r.get("conclusion") not in PASSING
    ]

    if unfinished:
        print(
            "not finished, so not green: "
            + ", ".join(f"{r.get('name')} ({r.get('status')})" for r in unfinished)
            + "\nPublishing may not race the pipeline that is supposed to gate it.",
            file=sys.stderr,
        )
        return 1
    if failed:
        print(
            "not green: "
            + ", ".join(f"{r.get('name')} ({r.get('conclusion')})" for r in failed)
            + "\nA published image cannot be recalled - refusing.",
            file=sys.stderr,
        )
        return 1

    print("  all considered checks passed - publishing allowed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
