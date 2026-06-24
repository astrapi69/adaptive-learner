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

    def test_launcher_json_locale_and_cleanup_search(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        assert cfg.single_instance is True
        assert cfg.cleanup_search_paths == ["~/.config/", "~/.local/share/", "~/"]
        # locale "auto" is resolved to a concrete code by from_json -> resolve().
        assert cfg.locale in ("de", "en", "el", "es", "fr", "hi", "ja", "ko", "pt", "tr", "id")

    def test_launcher_json_uses_brand_mark_icon(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        # The brand mark resolves from the repo-root CWD the launcher chdirs to;
        # the tray reuses it (tray_icon_path empty -> falls back to icon_path).
        assert cfg.icon_path == "frontend/branding/adaptive-learner-mark.png"
        assert cfg.tray_icon_path == ""

    def test_launcher_json_declares_internal_ports(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        assert cfg.show_advanced_ports is True
        assert cfg.internal_ports == {"backend": 8000, "nginx": 80}
        assert cfg.env_internal_port_keys == {
            "backend": "ADAPTIVE_LEARNER_BACKEND_PORT",
            "nginx": "ADAPTIVE_LEARNER_NGINX_PORT",
        }

    def test_legacy_names_drive_cleanup(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        assert "bibliogon" in cfg.legacy_names
        # Cleanup patterns include the container plus the legacy names.
        assert "adaptive-learner" in cfg.cleanup_patterns()
        assert "bibliogon" in cfg.cleanup_patterns()


class TestResolveAppDir:
    """The launcher must run with the Compose stack as its CWD so a port
    change writes ``.env`` where Compose reads it (docker-app-launcher#3)."""

    def _make_repo(self, base: Path) -> Path:
        base.mkdir(parents=True, exist_ok=True)
        (base / "docker-compose.prod.yml").write_text("services: {}\n")
        return base

    @pytest.fixture
    def isolate_source_root(self, tmp_path, monkeypatch):
        """Point the source-checkout candidate at a compose-less dir.

        The real checkout's repo root DOES carry ``docker-compose.prod.yml``, so
        without this the source-root candidate would always match and mask the
        env-var / home-default / None paths under test.
        """
        deep = tmp_path / "src" / "launcher" / "adaptive_learner_launcher"
        deep.mkdir(parents=True, exist_ok=True)
        monkeypatch.setattr(__main__, "_PACKAGE_DIR", deep)
        monkeypatch.setattr(__main__.Path, "home", staticmethod(lambda: tmp_path / "nohome"))
        return tmp_path

    def test_env_var_wins(self, tmp_path, monkeypatch) -> None:
        repo = self._make_repo(tmp_path / "custom")
        monkeypatch.setenv("ADAPTIVE_LEARNER_DIR", str(repo))
        assert __main__._resolve_app_dir() == repo

    def test_env_var_ignored_without_compose_file(self, isolate_source_root, monkeypatch) -> None:
        # A pointed-at dir that lacks the compose file is not a match; resolution
        # falls through and finds nothing here.
        monkeypatch.setenv("ADAPTIVE_LEARNER_DIR", str(isolate_source_root / "empty"))
        assert __main__._resolve_app_dir() is None

    def test_source_root_when_it_has_compose(self, tmp_path, monkeypatch) -> None:
        # Source checkout: <repo>/launcher/<package>/ -> <repo> holds the compose.
        repo = self._make_repo(tmp_path / "repo")
        deep = repo / "launcher" / "adaptive_learner_launcher"
        deep.mkdir(parents=True, exist_ok=True)
        monkeypatch.delenv("ADAPTIVE_LEARNER_DIR", raising=False)
        monkeypatch.setattr(__main__, "_PACKAGE_DIR", deep)
        assert __main__._resolve_app_dir() == repo

    def test_home_default_fallback(self, isolate_source_root, monkeypatch) -> None:
        monkeypatch.delenv("ADAPTIVE_LEARNER_DIR", raising=False)
        home = isolate_source_root / "home"
        self._make_repo(home / "adaptive-learner")
        monkeypatch.setattr(__main__.Path, "home", staticmethod(lambda: home))
        assert __main__._resolve_app_dir() == home / "adaptive-learner"

    def test_none_when_nothing_found(self, isolate_source_root) -> None:
        assert __main__._resolve_app_dir() is None

    def test_main_chdirs_into_resolved_dir(self, tmp_path, monkeypatch) -> None:
        repo = self._make_repo(tmp_path / "repo")
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: repo)
        chdirs: list[str] = []
        monkeypatch.setattr(__main__.os, "chdir", lambda p: chdirs.append(str(p)))
        monkeypatch.setattr(__main__, "_package_main", lambda args: 0)
        assert __main__.main(["--status"]) == 0
        assert chdirs == [str(repo)]

    def test_main_does_not_chdir_when_unresolved(self, monkeypatch) -> None:
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: None)
        chdirs: list[str] = []
        monkeypatch.setattr(__main__.os, "chdir", lambda p: chdirs.append(str(p)))
        monkeypatch.setattr(__main__, "_package_main", lambda args: 0)
        assert __main__.main(["--status"]) == 0
        assert chdirs == []
