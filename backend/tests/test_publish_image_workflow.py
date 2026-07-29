"""Pins the GHCR publish workflow's load-bearing promises (#2142).

A workflow cannot be unit-tested end to end, but the properties that make
it trustworthy are all statements ABOUT the file, and every one of them
was a real failure mode somewhere: an amd64-only image on Apple silicon,
a package left private so the first user pull 401s, a verification pull
that passes only because the runner is still logged in, and an image that
claims a version it does not carry.

Five-point contract (#2135) applies to this check too: it reports what it
examined, and it fails closed when the workflow is absent - a missing
file is not a passing workflow.
"""

from __future__ import annotations

from pathlib import Path

import pytest

WORKFLOW = Path(__file__).resolve().parents[2] / ".github" / "workflows" / "publish-image.yml"


@pytest.fixture(scope="module")
def workflow() -> str:
    if not WORKFLOW.is_file():
        pytest.fail(f"{WORKFLOW} is missing - a workflow that is gone is not a passing one")
    return WORKFLOW.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def parsed(workflow: str) -> dict:
    yaml = pytest.importorskip("yaml")
    return yaml.safe_load(workflow)


def test_reports_what_it_examined(parsed: dict) -> None:
    """Point 4: name the surface, so an empty parse cannot read as clean."""
    jobs = parsed["jobs"]
    assert jobs, "no jobs parsed - the check would pass on an empty file"
    print(f"examined {len(jobs)} job(s): {', '.join(jobs)}")
    assert {"build-and-push", "verify-anonymous-pull"} <= set(jobs)


def test_builds_both_architectures(workflow: str) -> None:
    """Apple silicon runs arm64; an amd64-only image refuses or crawls."""
    assert "linux/amd64,linux/arm64" in workflow


def test_publishes_on_the_release_event(parsed: dict) -> None:
    """Same hook as the launcher binaries - part of the release, not beside it."""
    triggers = parsed[True] if True in parsed else parsed["on"]
    assert "release" in triggers
    assert triggers["release"]["types"] == ["created"]


def test_dispatch_defaults_to_a_dry_run(parsed: dict) -> None:
    """A manual run must not put a public image outside a real release."""
    triggers = parsed[True] if True in parsed else parsed["on"]
    assert triggers["workflow_dispatch"]["inputs"]["dry_run"]["default"] is True


def test_sets_the_package_public(workflow: str) -> None:
    """A GHCR package is private on first publish; a 401 on the first user
    pull looks exactly like a broken release."""
    assert "visibility=public" in workflow


def test_the_verification_job_never_logs_in(parsed: dict) -> None:
    """A pull that works with CI credentials proves nothing about a user."""
    steps = parsed["jobs"]["verify-anonymous-pull"]["steps"]
    used = [step.get("uses", "") for step in steps]
    assert not any("login-action" in u for u in used), "the anonymous pull job authenticates"
    body = "\n".join(str(step.get("run", "")) for step in steps)
    assert "docker logout" in body


def test_version_disagreement_is_a_hard_failure(workflow: str) -> None:
    """Tag, image and /api/health must be the same string."""
    assert "/api/health" in workflow
    assert "::error::/api/health reports" in workflow
    assert "::error::tag version" in workflow


def test_the_size_gate_runs_against_the_published_image(parsed: dict) -> None:
    """Gating a local build would gate a different artifact than users get."""
    steps = parsed["jobs"]["verify-anonymous-pull"]["steps"]
    body = "\n".join(str(step.get("run", "")) for step in steps)
    assert "verify_image_size.py --image" in body
