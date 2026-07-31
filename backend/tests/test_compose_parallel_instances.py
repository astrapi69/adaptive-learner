"""Parallel local instances: the prod compose identity is env-overridable (#2122).

docker-compose.prod.yml hardcoded ``container_name: adaptive-learner`` and a
bare ``image:`` name, so a launcher config with its own compose_project still
collided with the real installation (containers and images shared). The
identity fields now interpolate ``${VAR:-safe-default}``: without env nothing
changes for existing installs; with env a ``-local`` test instance is fully
isolated (the named volume already isolates via the compose project prefix).

Structure is pinned by text (deterministic in every environment - the
release-gate container has no docker CLI, #2241); the resolved-config proof
runs wherever a docker CLI exists and skips loudly otherwise.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
COMPOSE = REPO_ROOT / "docker-compose.prod.yml"


def test_container_name_is_env_overridable_with_the_stable_default() -> None:
    text = COMPOSE.read_text(encoding="utf-8")
    assert re.search(
        r"container_name:\s*\$\{ADAPTIVE_LEARNER_CONTAINER_NAME:-adaptive-learner\}", text
    ), "container_name must interpolate with the stable default (#2122)"


def test_image_name_is_env_overridable_with_the_stable_default() -> None:
    text = COMPOSE.read_text(encoding="utf-8")
    assert re.search(
        r"image:\s*\$\{ADAPTIVE_LEARNER_IMAGE_NAME:-adaptive-learner\}"
        r":\$\{ADAPTIVE_LEARNER_APP_VERSION:-\d+\.\d+\.\d+\}",
        text,
    ), "image must interpolate name AND keep the #2034 version stamp"


@pytest.mark.skipif(shutil.which("docker") is None, reason="docker CLI unavailable")
def test_resolved_config_isolates_a_local_instance() -> None:
    """With override env, docker compose resolves a fully -local identity;
    without env, the defaults are byte-identical to the shipped names."""
    plain = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE), "config"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        env={"PATH": "/usr/bin:/bin", "HOME": str(Path.home())},
    )
    assert plain.returncode == 0, plain.stderr
    assert "container_name: adaptive-learner\n" in plain.stdout
    local = subprocess.run(
        ["docker", "compose", "-f", str(COMPOSE), "config"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        env={
            "PATH": "/usr/bin:/bin",
            "HOME": str(Path.home()),
            "ADAPTIVE_LEARNER_CONTAINER_NAME": "adaptive-learner-local",
            "ADAPTIVE_LEARNER_IMAGE_NAME": "adaptive-learner-local",
            "COMPOSE_PROJECT_NAME": "adaptive-learner-local",
        },
    )
    assert local.returncode == 0, local.stderr
    assert "container_name: adaptive-learner-local\n" in local.stdout
    assert "image: adaptive-learner-local:" in local.stdout
