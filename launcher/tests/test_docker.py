# TEMPLATE: This test is included as adaptable example.
# Replace with your domain logic when project domain is finalized.

"""Tests for launcher.docker. The subprocess surface is mocked."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from adaptive_learner_launcher import docker


def _run_result(returncode: int = 0, stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


class TestDockerInstalled:
    """docker.docker_installed is a thin wrapper over actions (#970);
    the behaviour is tested in test_actions. Here we pin the delegation."""

    def test_delegates_to_actions(self) -> None:
        from adaptive_learner_launcher import actions
        with patch.object(actions, "docker_installed", return_value=(True, "Docker version 27.1")) as m:
            assert docker.docker_installed() == (True, "Docker version 27.1")
        m.assert_called_once()


class TestDockerDaemonRunning:

    def test_delegates_to_actions_check_docker(self) -> None:
        from adaptive_learner_launcher import actions
        with patch.object(actions, "check_docker", return_value=(True, "ok")) as m:
            assert docker.docker_daemon_running() == (True, "ok")
        m.assert_called_once()


class TestComposeUpDown:

    def test_compose_up_success(self, tmp_path: Path) -> None:
        with patch("adaptive_learner_launcher.docker._run", return_value=_run_result(stdout="done")) as mock_run:
            ok, _ = docker.compose_up(tmp_path, "docker-compose.prod.yml")
        assert ok is True
        args = mock_run.call_args[0][0]
        assert args == ["docker", "compose", "-f", "docker-compose.prod.yml", "up", "-d"]

    def test_compose_up_failure_returns_tail(self, tmp_path: Path) -> None:
        stderr = "\n".join(f"line {i}" for i in range(20))
        with patch("adaptive_learner_launcher.docker._run", return_value=_run_result(returncode=1, stderr=stderr)):
            ok, detail = docker.compose_up(tmp_path, "docker-compose.prod.yml")
        assert ok is False
        assert "line 19" in detail
        assert "line 0" not in detail  # only tail

    def test_compose_down_success(self, tmp_path: Path) -> None:
        with patch("adaptive_learner_launcher.docker._run", return_value=_run_result()):
            ok, _ = docker.compose_down(tmp_path, "docker-compose.prod.yml")
        assert ok is True


class TestComposeLogsTail:
    """Thin wrapper over actions (#970)."""

    def test_delegates_to_actions(self, tmp_path: Path) -> None:
        from adaptive_learner_launcher import actions
        with patch.object(actions, "compose_logs_tail", return_value="log lines") as m:
            assert docker.compose_logs_tail(tmp_path, "docker-compose.prod.yml") == "log lines"
        m.assert_called_once()


class TestRemoveVolumes:
    """Thin wrapper over actions (#970)."""

    def test_delegates_to_actions(self) -> None:
        from adaptive_learner_launcher import actions
        with patch.object(actions, "remove_volumes", return_value=(True, "2 Volume(s) entfernt.")) as m:
            assert docker.remove_volumes() == (True, "2 Volume(s) entfernt.")
        m.assert_called_once()


class TestRemoveImages:
    """Thin wrapper over actions (#970)."""

    def test_delegates_to_actions(self) -> None:
        from adaptive_learner_launcher import actions
        with patch.object(actions, "remove_images", return_value=(True, "1 Image(s) entfernt.")) as m:
            assert docker.remove_images() == (True, "1 Image(s) entfernt.")
        m.assert_called_once()


class TestComposeBuild:
    """Thin wrapper over actions.compose_build (#970)."""

    def test_delegates_to_actions(self, tmp_path: Path) -> None:
        from adaptive_learner_launcher import actions
        with patch.object(actions, "compose_build", return_value=(True, "gebaut")) as m:
            ok, detail = docker.compose_build(tmp_path, "docker-compose.prod.yml")
        assert ok and detail == "gebaut"
        m.assert_called_once()


class TestRemoveContainers:
    """remove_containers must remove by id AND verify the container is gone,
    so the uninstall never claims success while a container survives (#964)."""

    def test_success_when_none_remain(self) -> None:
        # ps (one container) -> rm -> ps (empty) == success.
        with patch(
            "adaptive_learner_launcher.docker._run",
            side_effect=[
                _run_result(stdout="abc123\n"),  # list before
                _run_result(stdout=""),            # rm -f
                _run_result(stdout=""),            # list after (verify): gone
            ],
        ):
            ok, detail = docker.remove_containers()
        assert ok is True
        assert "removed 1" in detail

    def test_failure_when_container_survives(self) -> None:
        # ps -> rm -> ps still lists the container == verified failure.
        with patch(
            "adaptive_learner_launcher.docker._run",
            side_effect=[
                _run_result(stdout="abc123\n"),
                _run_result(stdout=""),
                _run_result(stdout="abc123\n"),  # still present!
            ],
        ):
            ok, detail = docker.remove_containers()
        assert ok is False
        assert "could not be removed" in detail

    def test_noop_when_no_containers(self) -> None:
        with patch(
            "adaptive_learner_launcher.docker._run",
            side_effect=[_run_result(stdout=""), _run_result(stdout="")],
        ):
            ok, detail = docker.remove_containers()
        assert ok is True
        assert "removed 0" in detail
