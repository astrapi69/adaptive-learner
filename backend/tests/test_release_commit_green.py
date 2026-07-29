"""Pins the publish precondition (#2145).

`release: created` fires whether or not the target commit's checks ran.
Every release-driven job published from a commit whose state it never
looked at - and an image somebody has pulled cannot be recalled, which
makes publishing the least reversible operation in the project.

Five-point contract: it detects a red commit, passes on a green one,
fails CLOSED on pending/unknown/empty ("a status that could not be read
is not a passing status"), reports how many checks it considered, and
its verdict does not depend on the environment it runs in - the input is
the API payload, nothing else.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "verify_release_commit_green.py"


def _run(payload: object, *extra: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), "--from-json", "-", *extra],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )


def _run_of(name: str, status: str, conclusion: str | None) -> dict:
    return {"name": name, "status": status, "conclusion": conclusion}


def test_green_commit_passes() -> None:
    result = _run([_run_of("CI", "completed", "success"), _run_of("Gate", "completed", "skipped")])
    assert result.returncode == 0, result.stderr
    assert "2 check(s)" in result.stdout


def test_reports_what_it_considered() -> None:
    """Point 4: the count and the names, or an empty set reads as clean."""
    result = _run([_run_of("CI", "completed", "success")])
    assert "CI" in result.stdout
    assert "1 check(s)" in result.stdout


def test_a_failed_check_blocks() -> None:
    result = _run([_run_of("CI", "completed", "failure")])
    assert result.returncode == 1
    assert "CI" in result.stderr


def test_a_pending_check_blocks() -> None:
    """Not finished is not green - publishing may not race the pipeline."""
    result = _run([_run_of("CI", "in_progress", None), _run_of("Gate", "completed", "success")])
    assert result.returncode == 1
    assert "not finished" in result.stderr


def test_an_empty_check_list_fails_closed() -> None:
    """The classic no-op: nothing to look at is not nothing wrong."""
    result = _run([])
    assert result.returncode == 1
    assert "no checks" in result.stderr


def test_unparsable_input_fails_closed() -> None:
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--from-json", "-"],
        input="{not json",
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "could not read" in result.stderr


def test_its_own_run_is_ignored_but_others_are_not() -> None:
    """The publishing workflow is itself in progress while it asks."""
    payload = [
        _run_of("Publish image (GHCR)", "in_progress", None),
        _run_of("CI", "completed", "success"),
    ]
    ok = _run(payload, "--ignore", "Publish image (GHCR)")
    assert ok.returncode == 0, ok.stderr
    # ... and ignoring must not become a way to wave a red check through
    red = _run(
        [
            _run_of("Publish image (GHCR)", "in_progress", None),
            _run_of("CI", "completed", "failure"),
        ],
        "--ignore",
        "Publish image (GHCR)",
    )
    assert red.returncode == 1


def test_ignoring_everything_leaves_nothing_and_fails() -> None:
    """A filter that empties the set must not produce a green verdict."""
    result = _run([_run_of("CI", "completed", "success")], "--ignore", "CI")
    assert result.returncode == 1
    assert "no checks" in result.stderr


def test_every_release_driven_workflow_has_the_precondition() -> None:
    """The finding this fixes: all four published without ever looking.

    Reports the set it examined, so adding a fifth publishing workflow
    without the guard cannot pass by the scan being empty.
    """
    workflows = sorted((REPO_ROOT / ".github" / "workflows").glob("*.yml"))
    assert workflows, "no workflows found - the scan proves nothing"
    release_driven = [
        path
        for path in workflows
        if "release:\n    types: [created]" in path.read_text(encoding="utf-8")
    ]
    print(f"examined {len(workflows)} workflow(s), {len(release_driven)} release-driven")
    assert len(release_driven) >= 4, f"expected the four publishers, found {len(release_driven)}"
    missing = [
        path.name
        for path in release_driven
        if "verify_release_commit_green.py" not in path.read_text(encoding="utf-8")
    ]
    assert not missing, f"publish without checking the commit was green: {missing}"


def test_each_publisher_ignores_only_itself() -> None:
    """Ignoring is how the check avoids deadlocking on its own run - it must
    not become a way to wave someone else's red check through."""
    for path in sorted((REPO_ROOT / ".github" / "workflows").glob("*.yml")):
        text = path.read_text(encoding="utf-8")
        if "verify_release_commit_green.py" not in text:
            continue
        ignores = [line for line in text.splitlines() if "--ignore" in line]
        assert len(ignores) == 1, f"{path.name} ignores more than one check: {ignores}"
