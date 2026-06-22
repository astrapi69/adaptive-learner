"""Tests for the launcher actions layer. No tkinter / no display needed.

Docker is mocked at ``actions._run`` (or the high-level helpers
``check_docker`` / ``get_state`` / ``_project_container_ids``); ports use
real sockets; config uses tmp files; health uses a mocked urlopen. These
run in CI without Docker or a GUI. Minimum 5 tests per action.
"""

from __future__ import annotations

import json
import socket
import subprocess
import urllib.error
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from adaptive_learner_launcher import actions


def _result(returncode: int = 0, stdout: str = "", stderr: str = "") -> subprocess.CompletedProcess:
    return subprocess.CompletedProcess(args=[], returncode=returncode, stdout=stdout, stderr=stderr)


def _bind_free_port() -> tuple[socket.socket, int]:
    """Bind a listening socket on an ephemeral port; caller closes it."""
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    sock.listen(1)
    return sock, sock.getsockname()[1]


# --- check_docker (5) -----------------------------------------------------

class TestCheckDocker:
    def test_running(self) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="info")):
            ok, msg = actions.check_docker()
        assert ok is True and isinstance(msg, str)

    def test_not_installed(self) -> None:
        with patch.object(actions, "_run", side_effect=FileNotFoundError):
            ok, msg = actions.check_docker()
        assert ok is False and "nicht installiert" in msg

    def test_daemon_stopped(self) -> None:
        with patch.object(actions, "_run", return_value=_result(returncode=1, stderr="cannot connect")):
            ok, msg = actions.check_docker()
        assert ok is False and "gestartet" in msg

    def test_timeout(self) -> None:
        with patch.object(actions, "_run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=10)):
            ok, msg = actions.check_docker()
        assert ok is False and "antwortet nicht" in msg

    def test_permission_denied(self) -> None:
        with patch.object(actions, "_run", return_value=_result(returncode=1, stderr="permission denied")):
            ok, msg = actions.check_docker()
        assert ok is False and isinstance(msg, str)


# --- get_state (6) --------------------------------------------------------

class TestGetState:
    def test_no_docker(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (False, "down"))
        assert actions.get_state("adaptive-learner") == "no_docker"

    def test_not_installed(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: [])
        assert actions.get_state() == "not_installed"

    def test_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: ["c1"])
        assert actions.get_state() == "running"

    def test_stopped(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids",
                            lambda *, running_only: [] if running_only else ["c1"])
        assert actions.get_state() == "stopped"

    def test_both_containers_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: ["backend", "frontend"])
        assert actions.get_state() == "running"

    def test_any_running_is_running(self, monkeypatch) -> None:
        # One of two containers running -> treated as running (app reachable).
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids",
                            lambda *, running_only: ["backend"] if running_only else ["backend", "frontend"])
        assert actions.get_state() == "running"


# --- check_port (6) -------------------------------------------------------

class TestCheckPort:
    def test_free(self) -> None:
        ok, msg = actions.check_port(59999)
        assert ok is True and "frei" in msg

    def test_occupied(self) -> None:
        sock, port = _bind_free_port()
        try:
            ok, msg = actions.check_port(port)
            assert ok is False and "belegt" in msg
        finally:
            sock.close()

    def test_port_zero_invalid(self) -> None:
        ok, msg = actions.check_port(0)
        assert ok is False

    def test_below_minimum(self) -> None:
        ok, msg = actions.check_port(1023)
        assert ok is False and "1024" in msg and "65535" in msg

    def test_above_maximum(self) -> None:
        ok, _ = actions.check_port(65536)
        assert ok is False

    def test_default_port_returns_bool(self) -> None:
        ok, msg = actions.check_port(actions.DEFAULT_PORT)
        assert isinstance(ok, bool) and isinstance(msg, str)


# --- find_free_port (5) ---------------------------------------------------

class TestFindFreePort:
    def test_start_free(self) -> None:
        found, port, _ = actions.find_free_port(59000)
        assert found is True and port == 59000

    def test_start_occupied_next_free(self) -> None:
        sock, port = _bind_free_port()
        try:
            found, chosen, _ = actions.find_free_port(port)
            assert found is True and chosen > port
        finally:
            sock.close()

    def test_invalid_start_below_min(self) -> None:
        found, port, msg = actions.find_free_port(1023)
        assert found is False and port == 0 and "Ungueltig" in msg

    def test_none_free_returns_zero(self) -> None:
        with patch.object(actions, "check_port", return_value=(False, "belegt")):
            found, port, msg = actions.find_free_port(50000, max_tries=3)
        assert found is False and port == 0

    def test_returns_port_in_range(self) -> None:
        found, port, _ = actions.find_free_port(58000)
        assert found is True and actions.MIN_PORT <= port <= actions.MAX_PORT


# --- install (8) ----------------------------------------------------------

class TestInstall:
    def _ok_guards(self, monkeypatch, *, state_seq) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "check_port", lambda p: (True, "frei"))
        seq = iter(state_seq)
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: next(seq))

    def test_normal_install(self, monkeypatch, tmp_path) -> None:
        compose = tmp_path / "docker-compose.prod.yml"
        compose.write_text("services: {}")
        self._ok_guards(monkeypatch, state_seq=["not_installed", "running"])
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        monkeypatch.setattr(actions, "health_check", lambda *a, **k: (True, "ok"))
        ok, msg = actions.install(str(compose), "adaptive-learner", 8501)
        assert ok is True and "abgeschlossen" in msg

    def test_compose_file_missing(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "not_installed")
        ok, msg = actions.install("/nope/does-not-exist.yml", "adaptive-learner", 8501)
        assert ok is False and "nicht gefunden" in msg

    def test_docker_not_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (False, "down"))
        ok, msg = actions.install("x.yml", "adaptive-learner", 8501)
        assert ok is False and "Docker" in msg

    def test_port_occupied(self, monkeypatch, tmp_path) -> None:
        compose = tmp_path / "c.yml"
        compose.write_text("x")
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "not_installed")
        monkeypatch.setattr(actions, "check_port", lambda p: (False, "Port 8501 ist belegt."))
        ok, msg = actions.install(str(compose), "adaptive-learner", 8501)
        assert ok is False and "belegt" in msg

    def test_build_fails(self, monkeypatch, tmp_path) -> None:
        compose = tmp_path / "c.yml"
        compose.write_text("x")
        self._ok_guards(monkeypatch, state_seq=["not_installed"])
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result(returncode=1, stderr="npm ci failed"))
        ok, msg = actions.install(str(compose), "adaptive-learner", 8501)
        assert ok is False and "fehlgeschlagen" in msg

    def test_health_check_fails(self, monkeypatch, tmp_path) -> None:
        compose = tmp_path / "c.yml"
        compose.write_text("x")
        self._ok_guards(monkeypatch, state_seq=["not_installed", "running"])
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        monkeypatch.setattr(actions, "health_check", lambda *a, **k: (False, "timeout"))
        ok, msg = actions.install(str(compose), "adaptive-learner", 8501)
        assert ok is False and "nicht erreichbar" in msg

    def test_already_installed(self, monkeypatch, tmp_path) -> None:
        compose = tmp_path / "c.yml"
        compose.write_text("x")
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "running")
        ok, msg = actions.install(str(compose), "adaptive-learner", 8501)
        assert ok is True and "bereits" in msg

    def test_invalid_port(self) -> None:
        ok, msg = actions.install("c.yml", "adaptive-learner", 80)
        assert ok is False and "Port" in msg


# --- compose_build (granular) (5) -----------------------------------------

class TestComposeBuild:
    def test_success(self) -> None:
        with patch.object(actions, "_run", return_value=_result()):
            ok, msg = actions.compose_build("c.yml", "adaptive-learner")
        assert ok is True

    def test_build_fails(self) -> None:
        with patch.object(actions, "_run", return_value=_result(returncode=1, stderr="npm ci failed")):
            ok, msg = actions.compose_build("c.yml", "adaptive-learner")
        assert ok is False and "fehlgeschlagen" in msg

    def test_docker_missing(self) -> None:
        with patch.object(actions, "_run", side_effect=FileNotFoundError):
            ok, msg = actions.compose_build("c.yml", "adaptive-learner")
        assert ok is False

    def test_timeout(self) -> None:
        with patch.object(actions, "_run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=600)):
            ok, msg = actions.compose_build("c.yml", "adaptive-learner")
        assert ok is False and "Zeitlimit" in msg

    def test_uses_project_and_build_flags(self) -> None:
        with patch.object(actions, "_run", return_value=_result()) as run_mock:
            actions.compose_build("c.yml", "adaptive-learner")
        cmd = run_mock.call_args[0][0]
        assert "-p" in cmd and "adaptive-learner" in cmd and "--build" in cmd


# --- start (6) ------------------------------------------------------------

class TestStart:
    def test_docker_not_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (False, "down"))
        ok, msg = actions.start("c.yml", "adaptive-learner")
        assert ok is False and "Docker" in msg

    def test_already_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "running")
        ok, msg = actions.start("c.yml", "adaptive-learner")
        assert ok is True and "laeuft bereits" in msg

    def test_starts_from_removed_state(self, monkeypatch) -> None:
        # not_installed (containers gone after `down`, images present) ->
        # compose up creates + starts them -> running (#977). Must NOT refuse.
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        seq = iter(["not_installed", "running"])
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: next(seq))
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        ok, msg = actions.start("c.yml", "adaptive-learner")
        assert ok is True

    def test_real_compose_error_when_nothing_to_start(self, monkeypatch) -> None:
        # A truly-missing compose file surfaces the real compose error,
        # not a misleading "nicht installiert".
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "not_installed")
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result(returncode=1, stderr="no configuration file"))
        ok, msg = actions.start("nope.yml", "adaptive-learner")
        assert ok is False and "fehlgeschlagen" in msg

    def test_starts_stopped_container(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        seq = iter(["stopped", "running"])
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: next(seq))
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        ok, msg = actions.start("c.yml", "adaptive-learner")
        assert ok is True

    def test_start_command_fails(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "stopped")
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result(returncode=1, stderr="boom"))
        ok, msg = actions.start("c.yml", "adaptive-learner")
        assert ok is False and "fehlgeschlagen" in msg

    def test_not_running_after_start(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        seq = iter(["stopped", "stopped"])
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: next(seq))
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        ok, msg = actions.start("c.yml", "adaptive-learner")
        assert ok is False


# --- stop (5) -------------------------------------------------------------

class TestStop:
    def test_docker_not_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (False, "down"))
        ok, msg = actions.stop("adaptive-learner")
        assert ok is False and "Docker" in msg

    def test_not_installed(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "not_installed")
        ok, msg = actions.stop("adaptive-learner")
        assert ok is False and "nicht installiert" in msg

    def test_already_stopped(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "stopped")
        ok, msg = actions.stop("adaptive-learner")
        assert ok is True and "bereits gestoppt" in msg

    def test_stops_running_and_verifies(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "running")
        # First list (to stop) returns ["c1"]; the verify list returns [].
        ids = iter([["c1"], []])
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: next(ids))
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        ok, msg = actions.stop("adaptive-learner")
        assert ok is True

    def test_still_running_after_stop(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "get_state", lambda *a, **k: "running")
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: ["c1"])
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        ok, msg = actions.stop("adaptive-learner")
        assert ok is False


# --- uninstall (7) --------------------------------------------------------

class TestUninstall:
    def test_docker_not_running(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (False, "down"))
        ok, msg = actions.uninstall("adaptive-learner")
        assert ok is False and "Docker" in msg

    def test_nothing_to_remove(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: [])
        ok, msg = actions.uninstall("adaptive-learner")
        assert ok is True and "Nichts" in msg

    def test_removes_running_and_verifies(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        ids = iter([["c1", "c2"], []])
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: next(ids))
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        monkeypatch.setattr(actions, "_remove_images", lambda: None)
        ok, msg = actions.uninstall("adaptive-learner")
        assert ok is True and "abgeschlossen" in msg

    def test_removes_stopped_and_verifies(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        ids = iter([["c1"], []])
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: next(ids))
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        monkeypatch.setattr(actions, "_remove_images", lambda: None)
        ok, _ = actions.uninstall("adaptive-learner")
        assert ok is True

    def test_partial_removal_reports_failure(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        ids = iter([["c1", "c2"], ["c2"]])  # one survives
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: next(ids))
        monkeypatch.setattr(actions, "_run", lambda *a, **k: _result())
        ok, msg = actions.uninstall("adaptive-learner")
        assert ok is False and "Teilweise" in msg

    def test_rm_raises(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: ["c1"])

        def boom(*a, **k):
            raise subprocess.TimeoutExpired(cmd="docker", timeout=60)

        monkeypatch.setattr(actions, "_run", boom)
        ok, msg = actions.uninstall("adaptive-learner")
        assert ok is False and "fehlgeschlagen" in msg

    def test_double_uninstall(self, monkeypatch) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "ok"))
        monkeypatch.setattr(actions, "_project_container_ids", lambda *, running_only: [])
        ok, msg = actions.uninstall("adaptive-learner")
        assert ok is True and "Nichts" in msg


# --- health_check (5) -----------------------------------------------------

class _Resp:
    def __init__(self, status: int, body: str = '{"status": "ok"}') -> None:
        self.status = status
        self._body = body

    def read(self) -> bytes:
        return self._body.encode("utf-8")

    def __enter__(self) -> "_Resp":
        return self

    def __exit__(self, *exc) -> bool:
        return False


class TestHealthCheck:
    def test_200_status_ok(self) -> None:
        with patch("urllib.request.urlopen", return_value=_Resp(200, '{"status": "ok"}')):
            ok, msg = actions.health_check(8501, "/api/health", timeout=2)
        assert ok is True and "ok" in msg

    def test_200_but_not_ok_is_unhealthy(self) -> None:
        # Stricter semantics: HTTP 200 with status != ok is NOT healthy.
        with patch("urllib.request.urlopen", return_value=_Resp(200, '{"status": "degraded"}')), \
             patch("time.sleep"):
            ok, _ = actions.health_check(8501, "/api/health", timeout=1)
        assert ok is False

    def test_invalid_json_is_unhealthy(self) -> None:
        with patch("urllib.request.urlopen", return_value=_Resp(200, "not json")), patch("time.sleep"):
            ok, _ = actions.health_check(8501, "/api/health", timeout=1)
        assert ok is False

    def test_connection_refused(self) -> None:
        with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("refused")), \
             patch("time.sleep"):
            ok, _ = actions.health_check(8501, "/api/health", timeout=1)
        assert ok is False

    def test_500_server_error(self) -> None:
        with patch("urllib.request.urlopen", return_value=_Resp(500)), patch("time.sleep"):
            ok, _ = actions.health_check(8501, "/api/health", timeout=1)
        assert ok is False

    def test_timeout_message(self) -> None:
        with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("x")), patch("time.sleep"):
            ok, msg = actions.health_check(8501, "/api/health", timeout=1)
        assert ok is False and "erreichbar" in msg

    def test_late_then_ok(self) -> None:
        with patch("urllib.request.urlopen", side_effect=[urllib.error.URLError("x"), _Resp(200)]), \
             patch("time.sleep"):
            ok, _ = actions.health_check(8501, "/api/health", timeout=5)
        assert ok is True


# --- is_healthy (single-shot) (5) -----------------------------------------

class TestIsHealthy:
    def test_ok(self) -> None:
        with patch("urllib.request.urlopen", return_value=_Resp(200, '{"status": "ok"}')):
            assert actions.is_healthy(8501) is True

    def test_status_not_ok(self) -> None:
        with patch("urllib.request.urlopen", return_value=_Resp(200, '{"status": "degraded"}')):
            assert actions.is_healthy(8501) is False

    def test_non_200(self) -> None:
        with patch("urllib.request.urlopen", return_value=_Resp(503)):
            assert actions.is_healthy(8501) is False

    def test_connection_error(self) -> None:
        with patch("urllib.request.urlopen", side_effect=urllib.error.URLError("refused")):
            assert actions.is_healthy(8501) is False

    def test_invalid_json(self) -> None:
        with patch("urllib.request.urlopen", return_value=_Resp(200, "not json")):
            assert actions.is_healthy(8501) is False


# --- open_browser (3) -----------------------------------------------------

class TestOpenBrowser:
    def test_opens_url(self) -> None:
        with patch("webbrowser.open") as mock:
            actions.open_browser(8501)
        mock.assert_called_once_with("http://localhost:8501/")

    def test_port_and_path(self) -> None:
        with patch("webbrowser.open") as mock:
            actions.open_browser(9000, "/import")
        mock.assert_called_once_with("http://localhost:9000/import")

    def test_never_raises(self) -> None:
        with patch("webbrowser.open", side_effect=OSError("no display")):
            actions.open_browser(8501)  # must not raise

    def test_default_path_is_root(self) -> None:
        with patch("webbrowser.open") as mock:
            actions.open_browser(8501)
        assert mock.call_args[0][0].endswith(":8501/")

    def test_custom_port(self) -> None:
        with patch("webbrowser.open") as mock:
            actions.open_browser(12345, "/")
        mock.assert_called_once_with("http://localhost:12345/")


# --- get_version (3) ------------------------------------------------------

class TestGetVersion:
    def test_is_string(self) -> None:
        assert isinstance(actions.get_version(), str)

    def test_has_dot(self) -> None:
        assert "." in actions.get_version()

    def test_non_empty(self) -> None:
        assert len(actions.get_version()) > 0

    def test_matches_module_version(self) -> None:
        from adaptive_learner_launcher import __version__
        assert actions.get_version() == __version__

    def test_semver_like(self) -> None:
        # At least major.minor.patch (two dots), e.g. 1.93.0.
        assert actions.get_version().count(".") >= 2


# --- load_config (5) ------------------------------------------------------

class TestLoadConfig:
    def test_valid_json(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text('{"port": 8501}')
        assert actions.load_config(path)["port"] == 8501

    def test_missing_file(self, tmp_path: Path) -> None:
        assert actions.load_config(tmp_path / "nope.json") == {}

    def test_empty_file(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("")
        assert actions.load_config(path) == {}

    def test_broken_json(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("{not json")
        assert actions.load_config(path) == {}

    def test_all_fields(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text('{"port": 9000, "project": "adaptive-learner", "compose_file": "x.yml"}')
        cfg = actions.load_config(path)
        assert cfg["port"] == 9000 and cfg["project"] == "adaptive-learner" and cfg["compose_file"] == "x.yml"


# --- save_config (5) ------------------------------------------------------

class TestSaveConfig:
    def test_writes_file(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        actions.save_config(path, {"port": 8501})
        assert path.is_file()

    def test_creates_parent_dir(self, tmp_path: Path) -> None:
        path = tmp_path / "sub" / "dir" / "c.json"
        actions.save_config(path, {"port": 8501})
        assert path.is_file()

    def test_overwrites(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text('{"port": 1}')
        actions.save_config(path, {"port": 9999})
        assert json.loads(path.read_text())["port"] == 9999

    def test_port_in_file(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        actions.save_config(path, {"port": 9000})
        assert json.loads(path.read_text())["port"] == 9000

    def test_roundtrip(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        data = {"port": 8501, "project": "adaptive-learner"}
        actions.save_config(path, data)
        assert actions.load_config(path) == data


# --- set_port (6) ---------------------------------------------------------

class TestSetPort:
    def test_valid_default(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("{}")
        ok, _ = actions.set_port(path, 8501)
        assert ok is True and json.loads(path.read_text())["port"] == 8501

    def test_minimum(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("{}")
        ok, _ = actions.set_port(path, 1024)
        assert ok is True

    def test_maximum(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("{}")
        ok, _ = actions.set_port(path, 65535)
        assert ok is True

    def test_below_minimum(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("{}")
        ok, _ = actions.set_port(path, 1023)
        assert ok is False

    def test_above_maximum(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("{}")
        ok, _ = actions.set_port(path, 65536)
        assert ok is False

    def test_zero(self, tmp_path: Path) -> None:
        path = tmp_path / "c.json"
        path.write_text("{}")
        ok, _ = actions.set_port(path, 0)
        assert ok is False


# --- docker_installed (5) -------------------------------------------------

class TestDockerInstalled:
    def test_installed(self) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="Docker version 27.1")):
            ok, msg = actions.docker_installed()
        assert ok is True and "Docker version" in msg

    def test_not_installed(self) -> None:
        with patch.object(actions, "_run", side_effect=FileNotFoundError):
            ok, msg = actions.docker_installed()
        assert ok is False and "nicht installiert" in msg

    def test_timeout(self) -> None:
        with patch.object(actions, "_run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=10)):
            ok, _ = actions.docker_installed()
        assert ok is False

    def test_nonzero_exit(self) -> None:
        with patch.object(actions, "_run", return_value=_result(returncode=1, stderr="boom")):
            ok, msg = actions.docker_installed()
        assert ok is False and "boom" in msg

    def test_distinct_from_check_docker(self, monkeypatch) -> None:
        # Installed but daemon down: docker_installed True, check_docker False.
        def fake_run(cmd, **kw):
            if "--version" in cmd:
                return _result(stdout="Docker version 27.1")
            return _result(returncode=1, stderr="cannot connect")  # docker info

        monkeypatch.setattr(actions, "_run", fake_run)
        assert actions.docker_installed()[0] is True
        assert actions.check_docker()[0] is False


# --- remove_volumes (5) ---------------------------------------------------

class TestRemoveVolumes:
    def test_removes_found(self) -> None:
        with patch.object(actions, "_run", side_effect=[_result(stdout="vol1\nvol2\n"), _result()]):
            ok, msg = actions.remove_volumes()
        assert ok is True and "2" in msg

    def test_none_found(self) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="")):
            ok, msg = actions.remove_volumes()
        assert ok is True and "Keine" in msg

    def test_docker_missing(self) -> None:
        with patch.object(actions, "_run", side_effect=FileNotFoundError):
            ok, msg = actions.remove_volumes()
        assert ok is True and "uebersprungen" in msg

    def test_rm_fails(self) -> None:
        def side(cmd, **kw):
            if "ls" in cmd:
                return _result(stdout="vol1\n")
            raise subprocess.TimeoutExpired(cmd="docker", timeout=30)

        with patch.object(actions, "_run", side_effect=side):
            ok, msg = actions.remove_volumes()
        assert ok is False and "fehlgeschlagen" in msg

    def test_returns_tuple(self) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="")):
            result = actions.remove_volumes()
        assert isinstance(result, tuple) and isinstance(result[0], bool)


# --- remove_images (5) ----------------------------------------------------

class TestRemoveImages:
    def test_removes_found(self) -> None:
        with patch.object(actions, "_run", side_effect=[_result(stdout="img1\n"), _result()]):
            ok, msg = actions.remove_images()
        assert ok is True and "1" in msg

    def test_none_found(self) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="")):
            ok, msg = actions.remove_images()
        assert ok is True and "Keine" in msg

    def test_docker_missing(self) -> None:
        with patch.object(actions, "_run", side_effect=FileNotFoundError):
            ok, msg = actions.remove_images()
        assert ok is True

    def test_rm_fails(self) -> None:
        def side(cmd, **kw):
            if "images" in cmd:
                return _result(stdout="img1\n")
            raise subprocess.TimeoutExpired(cmd="docker", timeout=60)

        with patch.object(actions, "_run", side_effect=side):
            ok, msg = actions.remove_images()
        assert ok is False

    def test_returns_tuple(self) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="")):
            assert isinstance(actions.remove_images(), tuple)


# --- stack_running (5) ----------------------------------------------------

class TestStackRunning:
    def test_running(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="abc123\n")):
            assert actions.stack_running(tmp_path, "docker-compose.prod.yml") is True

    def test_not_running_empty(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="")):
            assert actions.stack_running(tmp_path, "docker-compose.prod.yml") is False

    def test_nonzero_exit(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", return_value=_result(returncode=1)):
            assert actions.stack_running(tmp_path, "docker-compose.prod.yml") is False

    def test_docker_missing(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", side_effect=FileNotFoundError):
            assert actions.stack_running(tmp_path, "docker-compose.prod.yml") is False

    def test_timeout(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=15)):
            assert actions.stack_running(tmp_path, "docker-compose.prod.yml") is False


# --- compose_logs_tail (5) ------------------------------------------------

class TestComposeLogsTail:
    def test_returns_stdout(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="line1\nline2")):
            assert "line2" in actions.compose_logs_tail(tmp_path, "c.yml")

    def test_falls_back_to_stderr(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="", stderr="err")):
            assert actions.compose_logs_tail(tmp_path, "c.yml") == "err"

    def test_docker_missing(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", side_effect=FileNotFoundError):
            assert actions.compose_logs_tail(tmp_path, "c.yml") == ""

    def test_timeout(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", side_effect=subprocess.TimeoutExpired(cmd="docker", timeout=15)):
            assert actions.compose_logs_tail(tmp_path, "c.yml") == ""

    def test_passes_line_count(self, tmp_path: Path) -> None:
        with patch.object(actions, "_run", return_value=_result(stdout="x")) as run_mock:
            actions.compose_logs_tail(tmp_path, "c.yml", lines=7)
        assert "7" in run_mock.call_args[0][0]


# --- CLI <-> GUI parity ---------------------------------------------------

class TestCliGuiParity:
    """Every CLI action flag must map to an action function."""

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
            assert callable(getattr(actions, func_name, None)), (
                f"CLI --{flag} maps to actions.{func_name}, which is missing"
            )
