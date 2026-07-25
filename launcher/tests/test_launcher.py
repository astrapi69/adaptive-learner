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
from adaptive_learner_launcher import __main__, __version__
from docker_app_launcher import actions
from docker_app_launcher.config import LauncherConfig

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
        # bibliogon is a SEPARATE project, not an Adaptive Learner legacy name
        # (#1109) - it must never be matched, offered, or cleaned up here.
        assert cfg.legacy_names == ["adaptive_learner"]
        assert "bibliogon" not in cfg.legacy_names
        # Cleanup patterns include the container plus the legacy names.
        assert "adaptive-learner" in cfg.cleanup_patterns()
        assert "adaptive_learner" in cfg.cleanup_patterns()
        assert "bibliogon" not in cfg.cleanup_patterns()


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


def _fill_bundle(root: Path) -> None:
    """A complete bundle per the asset manifest (start self-check passes)."""
    from adaptive_learner_launcher import bundle_manifest

    root.mkdir(parents=True, exist_ok=True)
    for entry in bundle_manifest.BUNDLE_ASSETS:
        p = root / entry.bundle_path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("x", encoding="utf-8")
    for d in bundle_manifest.BUNDLE_DIRS:
        (root / d).mkdir(parents=True, exist_ok=True)
        (root / d / "de.yaml").write_text("x", encoding="utf-8")


class TestFrozenConfigResolution:
    """#2027: the frozen one-file binary must find the bundled launcher.json.

    In a PyInstaller one-file build the entry module's ``__file__`` is
    ``_MEIPASS/__main__.py`` (no package subdirectory), so resolving
    ``parent.parent / launcher.json`` escapes the bundle and the package
    silently falls back to the all-defaults config ("My App" window title).
    """

    def test_config_path_prefers_bundle_root_when_frozen(self, monkeypatch, tmp_path) -> None:
        bundled = tmp_path / "launcher.json"
        bundled.write_text("{}", encoding="utf-8")
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(tmp_path), raising=False)
        assert __main__._config_path() == bundled

    def test_config_path_source_checkout_unchanged(self) -> None:
        assert __main__._config_path() == LAUNCHER_JSON

    def test_frozen_cwd_with_compose_stays_untouched(self, monkeypatch, tmp_path) -> None:
        """A user running the binary from inside their own clone keeps that
        CWD (the package resolves the compose stack there)."""
        clone = tmp_path / "clone"
        clone.mkdir()
        (clone / "docker-compose.prod.yml").write_text("", encoding="utf-8")
        bundle = tmp_path / "bundle"
        _fill_bundle(bundle)
        monkeypatch.chdir(clone)
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(bundle), raising=False)
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: None)
        seen: dict[str, Path] = {}

        def fake_package_main(args):
            seen["cwd"] = Path.cwd()
            return 0

        monkeypatch.setattr(__main__, "_package_main", fake_package_main)
        assert __main__.main([]) == 0
        assert seen["cwd"] == clone


class TestBranding:
    """#2027 secondary: window icon must be resolvable in every run mode."""

    def test_icon_path_exists_in_repo(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        repo_root = LAUNCHER_JSON.parent.parent
        assert (repo_root / cfg.icon_path).is_file()

    def test_manifest_bundles_icon_at_config_relative_path(self) -> None:
        from adaptive_learner_launcher import bundle_manifest

        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        assert cfg.icon_path in {entry.bundle_path for entry in bundle_manifest.BUNDLE_ASSETS}


class TestExplicitConfigContract:
    """#32 (upstream 0.19.0): a missing explicit --config is a HARD error.

    The wrapper always injects its resolved --config path; with 0.19.0 a
    wrong bundled path can no longer silently launch the all-defaults
    "My App" window (the #2027 class) - it exits 2 with the path on stderr.
    """

    def test_wrapper_always_injects_explicit_config(self, monkeypatch) -> None:
        seen: dict[str, list[str]] = {}

        def fake_package_main(args):
            seen["args"] = list(args)
            return 0

        monkeypatch.setattr(__main__, "_package_main", fake_package_main)
        assert __main__.main([]) == 0
        assert seen["args"][0] == "--config"
        assert seen["args"][1] == str(__main__._config_path())

    def test_wrapper_respects_caller_config(self, monkeypatch) -> None:
        seen: dict[str, list[str]] = {}

        def fake_package_main(args):
            seen["args"] = list(args)
            return 0

        monkeypatch.setattr(__main__, "_package_main", fake_package_main)
        assert __main__.main(["--config", "/somewhere/else.json", "--check"]) == 0
        assert seen["args"].count("--config") == 1
        assert seen["args"][1] == "/somewhere/else.json"

    def test_missing_explicit_config_fails_hard(self, tmp_path, capsys) -> None:
        missing = tmp_path / "does-not-exist.json"
        rc = __main__.main(["--config", str(missing), "--check"])
        assert rc == 2
        err = capsys.readouterr().err
        assert str(missing) in err


class TestBundleManifest:
    """#2054: one manifest feeds the spec datas AND the frozen self-check."""

    def test_manifest_lists_the_runtime_assets(self) -> None:
        from adaptive_learner_launcher import bundle_manifest

        bundle_paths = {entry.bundle_path for entry in bundle_manifest.BUNDLE_ASSETS}
        assert "launcher.json" in bundle_paths
        assert "adaptive-learner.png" in bundle_paths
        assert "frontend/branding/adaptive-learner-mark.png" in bundle_paths
        assert "docker_app_launcher/i18n" in bundle_manifest.BUNDLE_DIRS

    def test_missing_assets_reports_all_gaps_at_once(self, tmp_path) -> None:
        from adaptive_learner_launcher import bundle_manifest

        (tmp_path / "launcher.json").write_text("{}", encoding="utf-8")
        missing = bundle_manifest.missing_assets(tmp_path)
        assert "adaptive-learner.png" in missing
        assert "frontend/branding/adaptive-learner-mark.png" in missing
        assert "docker_app_launcher/i18n" in missing
        assert "launcher.json" not in missing

    def test_spec_datas_derive_from_the_manifest(self) -> None:
        spec = (LAUNCHER_JSON.parent / "adaptive-learner-launcher.spec").read_text(encoding="utf-8")
        assert "bundle_manifest" in spec
        assert '("launcher.json", ".")' not in spec

    def test_verify_bundle_flag_fails_with_full_list(self, monkeypatch, tmp_path, capsys) -> None:
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(tmp_path), raising=False)
        rc = __main__.main(["--verify-bundle"])
        err = capsys.readouterr().err
        assert rc == 3
        assert "adaptive-learner.png" in err
        assert "docker_app_launcher/i18n" in err

    def test_verify_bundle_flag_ok_on_complete_bundle(self, monkeypatch, tmp_path, capsys) -> None:
        from adaptive_learner_launcher import bundle_manifest

        for entry in bundle_manifest.BUNDLE_ASSETS:
            p = tmp_path / entry.bundle_path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text("x", encoding="utf-8")
        for d in bundle_manifest.BUNDLE_DIRS:
            (tmp_path / d).mkdir(parents=True, exist_ok=True)
            (tmp_path / d / "de.yaml").write_text("x", encoding="utf-8")
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(tmp_path), raising=False)
        assert __main__.main(["--verify-bundle"]) == 0

    def test_frozen_start_blocks_early_on_incomplete_bundle(
        self, monkeypatch, tmp_path, capsys
    ) -> None:
        """#32 philosophy: one run names every gap, before the engine starts."""
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(tmp_path), raising=False)

        def boom(args):  # pragma: no cover - must not be reached
            raise AssertionError("engine must not start on an incomplete bundle")

        monkeypatch.setattr(__main__, "_package_main", boom)
        rc = __main__.main(["--check"])
        assert rc == 3
        assert "adaptive-learner.png" in capsys.readouterr().err


class TestSourceBootstrap:
    """#2054: standalone frozen run provisions the tagged source tree.

    The engine has no download step since #1064, but the install docs
    promise one; without a source tree the compose lookup dies in
    _MEIPASS (the device finding). The wrapper restores the Download
    step: fetch the tag matching the wrapper's app version, unpack to
    ADAPTIVE_LEARNER_DIR / ~/adaptive-learner, run from there.
    """

    def _tarball(self, version: str) -> bytes:
        import io
        import tarfile

        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as tar:
            data = b"services: {}\n"
            info = tarfile.TarInfo(f"adaptive-learner-{version}/docker-compose.prod.yml")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
        return buf.getvalue()

    def test_bootstrap_downloads_and_runs_from_target(self, monkeypatch, tmp_path) -> None:
        import io
        import json as _json

        cfg = tmp_path / "launcher.json"
        cfg.write_text(_json.dumps({"app_name": "X", "app_version": "9.9.9"}), encoding="utf-8")
        monkeypatch.setattr(__main__, "_config_path", lambda: cfg)
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: None)
        bundle = tmp_path / "bundle"
        _fill_bundle(bundle)
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(bundle), raising=False)
        target = tmp_path / "install-here"
        monkeypatch.setenv("ADAPTIVE_LEARNER_DIR", str(target))
        start_cwd = tmp_path / "elsewhere"
        start_cwd.mkdir()
        monkeypatch.chdir(start_cwd)
        seen: dict[str, object] = {}
        monkeypatch.setattr(
            __main__,
            "_download",
            lambda url, timeout=60.0: (
                seen.setdefault("url", url) and None or io.BytesIO(self._tarball("9.9.9"))
            ),
        )

        def fake_package_main(args):
            seen["cwd"] = Path.cwd()
            return 0

        monkeypatch.setattr(__main__, "_package_main", fake_package_main)
        assert __main__.main(["--check"]) == 0
        assert "v9.9.9.tar.gz" in str(seen["url"])
        assert seen["cwd"] == target
        assert (target / "docker-compose.prod.yml").is_file()

    def test_bootstrap_offline_fails_hard_with_instructions(
        self, monkeypatch, tmp_path, capsys
    ) -> None:
        import json as _json

        cfg = tmp_path / "launcher.json"
        cfg.write_text(_json.dumps({"app_name": "X", "app_version": "9.9.9"}), encoding="utf-8")
        monkeypatch.setattr(__main__, "_config_path", lambda: cfg)
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: None)
        bundle = tmp_path / "bundle"
        _fill_bundle(bundle)
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(bundle), raising=False)
        monkeypatch.setenv("ADAPTIVE_LEARNER_DIR", str(tmp_path / "t"))
        start_cwd = tmp_path / "elsewhere"
        start_cwd.mkdir()
        monkeypatch.chdir(start_cwd)

        def offline(url, timeout=60.0):
            raise OSError("network unreachable")

        monkeypatch.setattr(__main__, "_download", offline)
        rc = __main__.main(["--check"])
        err = capsys.readouterr().err
        assert rc == 4
        assert "v9.9.9.tar.gz" in err
        assert "install.sh" in err

    def test_existing_repo_skips_bootstrap(self, monkeypatch, tmp_path) -> None:
        app_dir = tmp_path / "repo"
        app_dir.mkdir()
        (app_dir / "docker-compose.prod.yml").write_text("", encoding="utf-8")
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: app_dir)

        def boom(url, timeout=60.0):  # pragma: no cover
            raise AssertionError("no download when a repo exists")

        monkeypatch.setattr(__main__, "_download", boom)
        seen: dict[str, Path] = {}
        monkeypatch.setattr(
            __main__, "_package_main", lambda args: seen.setdefault("cwd", Path.cwd()) and 0 or 0
        )
        assert __main__.main(["--check"]) == 0
        assert seen["cwd"] == app_dir
