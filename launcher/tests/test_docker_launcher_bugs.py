"""Tests for the docker helpers added for #942 (launcher Sammelauftrag)."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import patch

from adaptive_learner_launcher import docker


def _run_result(returncode: int = 0, stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


class TestStartDockerDesktop:

    def test_darwin_uses_open(self) -> None:
        with patch("adaptive_learner_launcher.docker.sys") as sysmod, \
             patch("adaptive_learner_launcher.docker.subprocess.Popen") as popen:
            sysmod.platform = "darwin"
            ok, detail = docker.start_docker_desktop()
        assert ok is True
        popen.assert_called_once()
        assert popen.call_args[0][0] == ["open", "-a", "Docker"]

    def test_linux_uses_systemctl_when_available(self) -> None:
        with patch("adaptive_learner_launcher.docker.sys") as sysmod, \
             patch("adaptive_learner_launcher.docker.shutil.which", return_value="/usr/bin/systemctl"), \
             patch("adaptive_learner_launcher.docker.subprocess.Popen") as popen:
            sysmod.platform = "linux"
            ok, detail = docker.start_docker_desktop()
        assert ok is True
        assert popen.call_args[0][0] == ["/usr/bin/systemctl", "--user", "start", "docker-desktop"]

    def test_linux_returns_false_when_nothing_found(self) -> None:
        with patch("adaptive_learner_launcher.docker.sys") as sysmod, \
             patch("adaptive_learner_launcher.docker.shutil.which", return_value=None):
            sysmod.platform = "linux"
            ok, detail = docker.start_docker_desktop()
        assert ok is False
        assert "launcher" in detail.lower()

    def test_handles_popen_oserror(self) -> None:
        with patch("adaptive_learner_launcher.docker.sys") as sysmod, \
             patch("adaptive_learner_launcher.docker.subprocess.Popen", side_effect=OSError("boom")):
            sysmod.platform = "darwin"
            ok, detail = docker.start_docker_desktop()
        assert ok is False
        assert "boom" in detail


class TestStackRunning:

    def test_true_when_container_ids_present(self, tmp_path: Path) -> None:
        with patch("adaptive_learner_launcher.docker._run", return_value=_run_result(stdout="abc123\n")):
            assert docker.stack_running(tmp_path, "docker-compose.prod.yml") is True

    def test_false_when_no_ids(self, tmp_path: Path) -> None:
        with patch("adaptive_learner_launcher.docker._run", return_value=_run_result(stdout="\n")):
            assert docker.stack_running(tmp_path, "docker-compose.prod.yml") is False

    def test_false_on_nonzero(self, tmp_path: Path) -> None:
        with patch("adaptive_learner_launcher.docker._run", return_value=_run_result(returncode=1)):
            assert docker.stack_running(tmp_path, "docker-compose.prod.yml") is False

    def test_false_when_docker_missing(self, tmp_path: Path) -> None:
        with patch("adaptive_learner_launcher.docker._run", side_effect=FileNotFoundError):
            assert docker.stack_running(tmp_path, "docker-compose.prod.yml") is False


class TestCleanupFiltersMatchBothNamingStyles:

    def test_remove_volumes_filters_hyphen_and_underscore(self) -> None:
        with patch("adaptive_learner_launcher.docker._run", return_value=_run_result(stdout="")) as run:
            docker.remove_volumes()
        args = run.call_args[0][0]
        assert "name=adaptive-learner" in args
        assert "name=adaptive_learner" in args

    def test_remove_images_filters_hyphen_and_underscore(self) -> None:
        with patch("adaptive_learner_launcher.docker._run", return_value=_run_result(stdout="")) as run:
            docker.remove_images()
        args = run.call_args[0][0]
        assert "reference=*adaptive-learner*" in args
        assert "reference=*adaptive_learner*" in args
