"""Tests for the thin Adaptive Learner launcher wrapper (#1064).

The launcher implementation lives in the ``docker-app-launcher`` PyPI
package; this wrapper only points it at ``launcher.json`` and preserves the
app version on ``--version``. So the tests are a smoke test (the entry point
runs and routes through the package) plus a config-loads test (the bundled
``launcher.json`` parses into the expected ``LauncherConfig``).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from docker_app_launcher import actions
from docker_app_launcher.config import LauncherConfig

from adaptive_learner_launcher import __main__, __version__

LAUNCHER_JSON = Path(__file__).resolve().parent.parent / "launcher.json"


class TestSmoke:
    def test_main_module_imports_clean(self) -> None:
        # Importing the entry point must not raise (PyInstaller-safe).
        assert hasattr(__main__, "main")

    def test_version_reports_app_version(self, capsys: pytest.CaptureFixture[str]) -> None:
        rc = __main__.main(["--version"])
        out = capsys.readouterr().out
        assert rc == 0
        assert "adaptive_learner_launcher" in out
        assert __version__ in out

    def test_check_routes_through_package(self, monkeypatch, capsys) -> None:
        monkeypatch.setattr(actions, "check_docker", lambda: (True, "Docker is running."))
        rc = __main__.main(["--check"])
        assert rc == 0
        assert "running" in capsys.readouterr().out.lower()

    def test_no_legacy_launcher_symbols(self) -> None:
        # The bespoke launcher internals were removed; the wrapper is thin.
        for gone in ("_setup_logging", "launcher_app", "_maybe_run_cli_action", "settings"):
            assert not hasattr(__main__, gone), f"{gone} should be gone (#1064)"


class TestConfigLoads:
    def test_launcher_json_exists(self) -> None:
        assert LAUNCHER_JSON.is_file()

    def test_launcher_json_parses_to_expected_config(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        assert cfg.app_name == "Adaptive Learner"
        assert cfg.container_name == "adaptive-learner"
        assert cfg.compose_project == "adaptive-learner"
        assert cfg.default_port == 8501
        assert cfg.env_port_key == "ADAPTIVE_LEARNER_PUBLIC_PORT"
        assert cfg.health_check_path == "/api/health"
        assert cfg.app_version == __version__

    def test_legacy_names_drive_cleanup(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        assert "bibliogon" in cfg.legacy_names
        # Cleanup patterns include the container plus the legacy names.
        assert "adaptive-learner" in cfg.cleanup_patterns()
        assert "bibliogon" in cfg.cleanup_patterns()
