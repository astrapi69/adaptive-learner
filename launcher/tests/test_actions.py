"""Tests for the launcher actions layer. No tkinter / no display needed.

Docker is mocked at ``actions._run``; ports use real sockets; config uses
tmp files. These run in CI without Docker or a GUI.
"""

from __future__ import annotations

import json
import socket
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest

from adaptive_learner_launcher import actions


def _result(returncode: int = 0, stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


class TestCheckDocker:
    def test_running(self) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="info")):
            ok, msg = actions.check_docker()
        assert ok is True and isinstance(msg, str)

    def test_not_installed(self) -> None:
        with patch.object(actions, "_run", side_effect=FileNotFoundError):
            ok, msg = actions.check_docker()
        assert ok is False and "nicht installiert" in msg

    def test_daemon_down(self) -> None:
        with patch.object(actions, "_run", return_value=_result(returncode=1, stderr="cannot connect")):
            ok, msg = actions.check_docker()
        assert ok is False


class TestGetState:
    def test_no_docker(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (False, "down"))
        assert actions.get_state("adaptive-learner") == "no_docker"

    def test_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: ["c1"])
        assert actions.get_state() == "running"

    def test_stopped(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids",
                            lambda *, running_only: [] if running_only else ["c1"])
        assert actions.get_state() == "stopped"

    def test_not_installed(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: [])
        assert actions.get_state() == "not_installed"


class TestCheckPort:
    def test_free(self) -> None:
        ok, msg = actions.check_port(59999)
        assert ok is True and "frei" in msg

    def test_occupied(self) -> None:
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        sock.listen(1)
        port = sock.getsockname()[1]
        try:
            ok, msg = actions.check_port(port)
            assert ok is False and "belegt" in msg
        finally:
            sock.close()

    def test_find_free_port(self) -> None:
        found, port, _ = actions.find_free_port(59000)
        assert found is True and 59000 <= port <= actions.MAX_PORT


class TestLifecycleVerification:
    def test_uninstall_success_when_gone(self) -> None:
        # ids present -> rm -> verify empty == success
        with patch.object(actions, "_project_container_ids", side_effect=[["c1"], []]), \
             patch.object(actions, "_run", return_value=_result()), \
             patch.object(actions, "_remove_images"):
            ok, msg = actions.uninstall("adaptive-learner")
        assert ok is True and "abgeschlossen" in msg

    def test_uninstall_fails_when_survives(self) -> None:
        with patch.object(actions, "_project_container_ids", side_effect=[["c1"], ["c1"]]), \
             patch.object(actions, "_run", return_value=_result()), \
             patch.object(actions, "_remove_images"):
            ok, msg = actions.uninstall("adaptive-learner")
        assert ok is False and "nicht entfernt" in msg

    def test_stop_verifies_no_running(self) -> None:
        with patch.object(actions, "_project_container_ids", side_effect=[["c1"], []]), \
             patch.object(actions, "_run", return_value=_result()):
            ok, msg = actions.stop("adaptive-learner")
        assert ok is True

    def test_stop_fails_if_still_running(self) -> None:
        with patch.object(actions, "_project_container_ids", side_effect=[["c1"], ["c1"]]), \
             patch.object(actions, "_run", return_value=_result()):
            ok, msg = actions.stop("adaptive-learner")
        assert ok is False

    def test_install_verifies_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "running")
        monkeypatch.setattr(actions, "health_check", lambda *a, **k: (True, "ok"))
        ok, msg = actions.install("docker-compose.prod.yml", "adaptive-learner", 8501)
        assert ok is True

    def test_install_fails_when_not_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "stopped")
        ok, msg = actions.install("docker-compose.prod.yml", "adaptive-learner", 8501)
        assert ok is False

    def test_install_rejects_bad_port(self) -> None:
        ok, msg = actions.install("docker-compose.prod.yml", "adaptive-learner", 80)
        assert ok is False and "Port" in msg


class TestConfig:
    def test_load_save_roundtrip(self, tmp_path: Path) -> None:
        path = tmp_path / "config.json"
        actions.save_config(path, {"port": 8501, "project": "adaptive-learner"})
        cfg = actions.load_config(path)
        assert cfg["port"] == 8501 and cfg["project"] == "adaptive-learner"

    def test_load_missing_returns_empty(self, tmp_path: Path) -> None:
        assert actions.load_config(tmp_path / "nope.json") == {}

    def test_set_port_valid(self, tmp_path: Path) -> None:
        path = tmp_path / "config.json"
        path.write_text("{}")
        ok, msg = actions.set_port(path, 9000)
        assert ok is True
        assert json.loads(path.read_text())["port"] == 9000

    def test_set_port_invalid_low(self, tmp_path: Path) -> None:
        path = tmp_path / "config.json"
        path.write_text("{}")
        ok, msg = actions.set_port(path, 80)
        assert ok is False

    def test_set_port_invalid_high(self, tmp_path: Path) -> None:
        path = tmp_path / "config.json"
        path.write_text("{}")
        ok, _ = actions.set_port(path, 70000)
        assert ok is False


class TestVersion:
    def test_has_dotted_version(self) -> None:
        assert "." in actions.get_version()


class TestCliGuiParity:
    """Every CLI action flag must map to an action function (CLI<->GUI parity)."""

    # CLI flag -> the action function that implements it.
    CLI_TO_ACTION = {
        "check": "check_docker",
        "status": "get_state",
        "install": "install",
        "start": "start",
        "stop": "stop",
        "uninstall": "uninstall",
        "open": "open_browser",
        "port": "set_port",
        "version": "get_version",
    }

    def test_every_cli_flag_has_action(self) -> None:
        for flag, func_name in self.CLI_TO_ACTION.items():
            assert hasattr(actions, func_name) and callable(getattr(actions, func_name)), (
                f"CLI --{flag} maps to actions.{func_name}, which is missing"
            )
