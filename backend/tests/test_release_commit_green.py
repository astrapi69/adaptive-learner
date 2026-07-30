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


def test_publishers_do_not_deadlock_each_other() -> None:
    """#2149: all four fire on the same event and each creates a check run.

    With one exclusion per job, every job saw the other three as pending and
    refused - deterministically, on every release. The exclusion set must be
    the whole release-driven run, not just the asking job.
    """
    for path in sorted((REPO_ROOT / ".github" / "workflows").glob("*.yml")):
        text = path.read_text(encoding="utf-8")
        if "verify_release_commit_green.py" not in text:
            continue
        assert "--exclude-release-jobs" in text, (
            f"{path.name} excludes only itself and will deadlock on its siblings"
        )


def test_release_jobs_are_derived_not_hardcoded() -> None:
    """A fifth publisher must be excluded without anyone remembering to."""
    import subprocess

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--from-json",
            "-",
            "--exclude-release-jobs",
            "--repo-root",
            str(REPO_ROOT),
        ],
        input=json.dumps(
            [
                _run_of("Build launcher binary", "in_progress", None),
                _run_of("Build launcher.exe", "in_progress", None),
                _run_of("Build launcher .app bundle", "in_progress", None),
                _run_of("Build multi-arch and push", "in_progress", None),
                _run_of("Pull and run it the way a user does (arm64)", "in_progress", None),
                _run_of("CI", "completed", "success"),
            ]
        ),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert "1 check(s) considered" in result.stdout, result.stdout


def test_a_red_regular_check_still_blocks_with_the_exclusion() -> None:
    """Excluding the release run must not wave the commit's own CI through."""
    import subprocess

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--from-json",
            "-",
            "--exclude-release-jobs",
            "--repo-root",
            str(REPO_ROOT),
        ],
        input=json.dumps(
            [
                _run_of("Build launcher binary", "in_progress", None),
                _run_of("CI", "completed", "failure"),
            ]
        ),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert "CI" in result.stderr


def test_the_exclusion_scan_fails_closed_without_workflows(tmp_path) -> None:
    """No workflows found means the basis is broken, not that nothing matched."""
    import subprocess

    result = subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--from-json",
            "-",
            "--exclude-release-jobs",
            "--repo-root",
            str(tmp_path),
        ],
        input=json.dumps([_run_of("CI", "completed", "success")]),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    # Either cause is fail-closed: the directory is absent, or it holds no
    # release-driven workflow. Both mean the exclusion set is unestablished.
    assert (
        "exclusion basis is missing" in result.stderr
        or "no release-driven workflows" in result.stderr
    )


import importlib.util as _ilu

_spec = _ilu.spec_from_file_location("verify_release_commit_green_under_test", SCRIPT)
vg = _ilu.module_from_spec(_spec)
_spec.loader.exec_module(vg)


class TestRepoResolution:
    """#2178: the bare ``commits/<sha>`` path 404s under ``gh api`` - the
    gate failed closed on EVERY release event, both attempts, and the
    publish chain could never pass. The incident (two identical 404s
    plus the local bare-vs-prefixed repro) is the RED proof."""

    def test_explicit_repo_wins(self, monkeypatch) -> None:
        monkeypatch.setenv("GITHUB_REPOSITORY", "env/repo")
        assert vg.resolve_repo("owner/name") == "owner/name"

    def test_actions_env_is_the_default(self, monkeypatch) -> None:
        monkeypatch.setenv("GITHUB_REPOSITORY", "astrapi69/adaptive-learner")
        assert vg.resolve_repo(None) == "astrapi69/adaptive-learner"

    def test_no_repo_anywhere_fails_closed_with_a_named_reason(
        self, monkeypatch, capsys
    ) -> None:
        monkeypatch.delenv("GITHUB_REPOSITORY", raising=False)
        assert vg.fetch("deadbeef", None) is None
        err = capsys.readouterr().err
        assert "GITHUB_REPOSITORY" in err
        assert "refusing to guess" in err

    def test_fetch_builds_the_prefixed_path(self, monkeypatch) -> None:
        monkeypatch.setenv("GITHUB_REPOSITORY", "astrapi69/adaptive-learner")
        seen: dict[str, list[str]] = {}

        def fake_run(command, **kwargs):
            seen["command"] = command

            class R:
                returncode = 0
                stdout = ""
                stderr = ""

            return R()

        monkeypatch.setattr(vg.subprocess, "run", fake_run)
        assert vg.fetch("deadbeef", None) == []
        target = seen["command"][3]
        assert target == "repos/astrapi69/adaptive-learner/commits/deadbeef/check-runs"
        assert not target.startswith("commits/"), "the bare path is the #2178 404"
