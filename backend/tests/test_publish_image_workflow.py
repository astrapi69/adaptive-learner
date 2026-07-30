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


def test_runs_on_demand_only_never_on_release_events(parsed: dict) -> None:
    """Option 1 (v2.8.0): created never fires for drafts; published would
    re-run the chain on draft-publish against a non-bit-identical rebuild
    (~48k bytes drift between identical-content builds) - the verified
    artifact must BE the shipped one. The chain runs via workflow_dispatch,
    triggered by the release checklist BEFORE the draft goes visible."""
    triggers = parsed[True] if True in parsed else parsed["on"]
    assert "release" not in triggers, "release-event trigger reintroduced (double-run class)"
    assert "workflow_dispatch" in triggers


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


def test_every_architecture_is_actually_started(parsed: dict) -> None:
    """Built is not run. The first version of this workflow pulled arm64 on an
    amd64 runner and started only amd64, so the arm64 image would have shipped
    without a single process ever having run inside it."""
    job = parsed["jobs"]["verify-anonymous-pull"]
    arches = {entry["arch"] for entry in job["strategy"]["matrix"]["include"]}
    assert arches == {"amd64", "arm64"}, f"only verified on {arches}"
    body = "\n".join(str(step.get("run", "")) for step in job["steps"])
    assert "docker run -d --name verify" in body, "no architecture is started"
    assert "/api/health" in body


def test_verification_runs_on_native_runners(parsed: dict) -> None:
    """Native arm64 runners are free for public repos (probed: ubuntu-24.04-arm
    reports aarch64), which also removes the emulation-only failure class."""
    include = parsed["jobs"]["verify-anonymous-pull"]["strategy"]["matrix"]["include"]
    runners = {entry["arch"]: entry["runner"] for entry in include}
    assert runners["arm64"].endswith("-arm"), f"arm64 verified on {runners['arm64']}"
    body = "\n".join(
        str(step.get("run", "")) for step in parsed["jobs"]["verify-anonymous-pull"]["steps"]
    )
    assert "--platform" not in body, "a forced platform would hide what the runner really pulled"


def test_the_pulled_architecture_is_asserted(parsed: dict) -> None:
    """Proof that the manifest list actually serves per-architecture images."""
    body = "\n".join(
        str(step.get("run", "")) for step in parsed["jobs"]["verify-anonymous-pull"]["steps"]
    )
    assert "{{.Architecture}}" in body
    assert "the manifest list is wrong" in body


def test_the_page_is_executed_not_just_requested(workflow: str) -> None:
    """#2197: the v2.8.0 white page shipped through a fully green chain of
    PROXIES (health JSON, status codes, script tags). The chain must run
    the page in a real browser and demand capability - element visible,
    console clean - plus the bare-container posture (#2198)."""
    assert "verify-container-page.mjs" in workflow
    assert '"debug":false' in workflow
    assert "default-src 'none'" in workflow
