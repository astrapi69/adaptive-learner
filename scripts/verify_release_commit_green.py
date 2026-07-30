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
import os
import subprocess
import sys
from pathlib import Path

# Conclusions that do not block a release. "neutral" and "skipped" are
# normal for path-filtered jobs; everything else (failure, cancelled,
# timed_out, action_required, stale) blocks.
PASSING = {"success", "neutral", "skipped"}


def resolve_repo(repo: str | None) -> str | None:
    """``--repo``, else the Actions-provided ``GITHUB_REPOSITORY``.

    ``gh api`` does NOT resolve a bare ``commits/...`` path against the
    current repo - that convenience exists only for ``{owner}/{repo}``
    placeholders. The bare fallback therefore 404'd on EVERY ``release:``
    run and the gate failed closed forever (#2178): correct per contract
    point 3, but a publish chain that can never pass. In Actions the env
    var is always present; passing ``--repo`` explicitly still wins.
    """
    return repo or os.environ.get("GITHUB_REPOSITORY") or None


def fetch(sha: str, repo: str | None) -> list[dict] | None:
    """Check runs for exactly this commit, or ``None`` when unreadable."""
    repo = resolve_repo(repo)
    if repo is None:
        print(
            "could not read the check status: no --repo given and "
            "GITHUB_REPOSITORY is unset - refusing to guess the repository",
            file=sys.stderr,
        )
        return None
    target = f"repos/{repo}/commits/{sha}/check-runs"
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


def release_driven_job_names(repo_root: Path) -> tuple[list[str], str | None]:
    """Display names of every job in a release-driven workflow.

    Derived from the workflows rather than hardcoded, so a fifth publisher
    is excluded without anyone remembering to add it. Returns the names and
    an error message when the scan itself could not be performed - finding
    nothing to exclude is only sound if we know we looked in the right place.
    """
    directory = repo_root / ".github" / "workflows"
    if not directory.is_dir():
        return [], f"cannot scan {directory} - the exclusion basis is missing"
    names: list[str] = []
    found_release_workflow = False
    for path in sorted(directory.glob("*.yml")):
        text = path.read_text(encoding="utf-8")
        if "release:" not in text or "types: [created]" not in text:
            continue
        found_release_workflow = True
        for line in text.splitlines():
            stripped = line.strip()
            if stripped.startswith("name:") and line.startswith("    name:"):
                value = stripped[len("name:") :].strip().strip("\"'")
                # A matrix job is declared as "<name> (${{ matrix.x }})" and
                # renders as "<name> (amd64)". Cut the interpolation AND the
                # opening bracket, so the base name is what the prefix match
                # below expects.
                base = value.split("${{")[0].strip().rstrip("(").strip()
                if base:
                    names.append(base)
    if not found_release_workflow:
        return [], (
            f"no release-driven workflows found under {directory} - refusing to "
            "publish on an exclusion set that could not be established"
        )
    return names, None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sha", help="the commit being published from")
    parser.add_argument("--repo", default=None, help="owner/name (default: $GITHUB_REPOSITORY)")
    parser.add_argument("--from-json", default=None, help="read check runs from a file or '-'")
    parser.add_argument(
        "--ignore",
        action="append",
        default=[],
        help="check name to exclude (matched as a prefix, for matrix jobs)",
    )
    parser.add_argument(
        "--exclude-release-jobs",
        action="store_true",
        help="exclude the whole release-driven run, derived from the workflows (#2149)",
    )
    parser.add_argument("--repo-root", default=".", help="where to scan for workflows")
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

    excluded = list(args.ignore)
    if args.exclude_release_jobs:
        derived, scan_error = release_driven_job_names(Path(args.repo_root))
        if scan_error:
            print(scan_error, file=sys.stderr)
            return 1
        excluded += derived

    def is_excluded(name: str) -> bool:
        # Prefix, not equality: a matrix job appears as "<name> (amd64)".
        return any(name == prefix or name.startswith(prefix + " (") for prefix in excluded)

    considered = [run for run in runs if not is_excluded(str(run.get("name", "")))]
    names = ", ".join(sorted(str(run.get("name", "?")) for run in considered))
    print(f"release precondition: {len(considered)} check(s) considered")
    if considered:
        print(f"  {names}")
    if excluded:
        print(f"  excluded ({len(excluded)}): {', '.join(sorted(set(excluded)))}")

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
