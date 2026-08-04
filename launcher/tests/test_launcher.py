"""Tests for the thin Adaptive Learner launcher wrapper (#1064).

The launcher implementation lives in the ``docker-app-launcher`` PyPI
package; this wrapper only points it at ``launcher.json`` and preserves the
app version on ``--version``. So the tests are a smoke test (the entry point
runs and routes through the package) plus a config-loads test (the bundled
``launcher.json`` parses into the expected ``LauncherConfig``).
"""

from __future__ import annotations

import json
import os
import re
import sys
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
        # The ports stay DECLARED - the launcher passes them into the
        # container. Single container since #2058: the nginx service is gone,
        # so only the backend port exists at all.
        assert cfg.internal_ports == {"backend": 8000}
        assert cfg.env_internal_port_keys == {"backend": "ADAPTIVE_LEARNER_BACKEND_PORT"}

    def test_the_internal_port_panel_is_off_because_we_ship_image_mode(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        # Both halves are asserted, deliberately, and NOT as an if/else
        # (#2345). The rule is: outside compose mode the internal port is
        # carried by the image itself - only a new app version can change it -
        # so docker-app-launcher is explicit that image/dockerfile consumers
        # must not offer the expert panel at all. Before 0.27.0 the control
        # took a Compose path this deployment never had and failed naming a
        # file that does not exist.
        #
        # Pinning only `show_advanced_ports is False` would survive a move
        # back to compose mode and silently keep the panel hidden where it
        # would work. Pinning only the mode would survive someone re-enabling
        # the panel. Together they fail whenever the pair stops agreeing, and
        # whoever changes one is made to look at the other.
        assert cfg.effective_deployment_mode == "image"
        assert cfg.show_advanced_ports is False

    def test_no_shipped_config_offers_the_panel_outside_compose_mode(self) -> None:
        # The rule, over EVERY config this repo ships - not just the live one.
        # launcher.example.json is what someone copies to start from, and it
        # carried `dockerfile` mode together with the panel switched on: the
        # exact pairing upstream says cannot work. A template that teaches the
        # wrong combination is worse than a wrong value in one file.
        configs = sorted(Path(LAUNCHER_JSON).parent.glob("launcher*.json"))

        # Report WHAT was scanned. An empty glob and a clean sweep both print
        # "no failures" otherwise, and only one of them means anything.
        assert len(configs) == 2, f"expected 2 shipped configs, found {configs}"

        for path in configs:
            cfg = LauncherConfig.from_json(str(path))
            if cfg.effective_deployment_mode == "compose":
                continue  # there the internal port really is tunable
            assert cfg.show_advanced_ports is False, (
                f"{path.name} offers the internal-port panel in "
                f"{cfg.effective_deployment_mode} mode, where it cannot take effect"
            )

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
        # Since #2109 the injected config is the ANCHORED copy: same content
        # plus an explicit install_dir, so app-relative paths resolve against
        # the app tree instead of the config file's own directory.
        injected = Path(seen["args"][1])
        assert injected.is_file()
        assert json.loads(injected.read_text(encoding="utf-8"))["install_dir"] == str(Path.cwd())

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


class TestDeploymentModeContract:
    """0.20.0 (#2059): a malformed dockerfile-mode block is a hard error."""

    def test_missing_dockerfile_is_a_named_hard_error(self, monkeypatch, tmp_path) -> None:
        from docker_app_launcher import actions
        from docker_app_launcher.docker import lifecycle

        monkeypatch.chdir(tmp_path)
        # install() binds check_docker inside the lifecycle module - patch
        # THAT reference, not the actions facade re-export (on a runner
        # without Docker the facade patch leaves the real guard active,
        # which is exactly how this test went red on macOS CI only).
        monkeypatch.setattr(lifecycle, "check_docker", lambda *a, **kw: (True, "ok"))
        bad = LauncherConfig(
            app_name="al-test-negativ",
            deployment_mode="dockerfile",
            dockerfile_file="does-not-exist.Dockerfile",
        ).resolve()
        ok, msg = actions.install(bad)
        assert ok is False
        assert "does-not-exist.Dockerfile" in msg

    def test_launcher_json_uses_image_mode(self) -> None:
        """#2110 Teil 4: the end-user path pulls the published image.

        Users never build. The reference is pinned to the app-version TAG
        (a digest does not exist yet when the release commit is made);
        `make sync-versions` rewrites the tag, and the from_json round trip
        proves the config is valid image-mode config for the pinned engine.
        """
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        assert cfg.deployment_mode == "image"
        assert cfg.image_reference == f"ghcr.io/astrapi69/adaptive-learner:{__version__}"
        assert cfg.image_archive == ""
        # The build-path fields are engine defaults now, no longer declared:
        # a declared build path in an image-mode config would be a dead
        # setting (architecture.md: dead settings are forbidden).
        raw = json.loads(LAUNCHER_JSON.read_text(encoding="utf-8"))
        assert "dockerfile_file" not in raw
        assert "build_context" not in raw
        assert cfg.container_port == 8000
        # The PREFIXED name: compose created it that way, and the data lives
        # there (#2154). Pinned so it cannot be "tidied up" back into a
        # silent data loss.
        assert cfg.container_volumes == {"adaptive-learner_adaptive-learner-data": "/app/data"}
        assert cfg.container_env["ADAPTIVE_LEARNER_DATA_DIR"] == "/app/data"
        assert cfg.container_env["ADAPTIVE_LEARNER_PORT"] == "8000"
        assert cfg.container_env["ADAPTIVE_LEARNER_SERVE_FRONTEND"] == "1"
        assert cfg.container_env["ADAPTIVE_LEARNER_FRONTEND_DIST"] == "/app/static"

    def test_source_tree_paths_for_dockerfile_mode_still_exist(self) -> None:
        """dockerfile mode stays the source-tree path (#2110 Teil 5)."""
        repo_root = LAUNCHER_JSON.parent.parent
        assert (repo_root / "backend" / "Dockerfile").is_file()
        # The compose file stays as the documented power-user alternative.
        assert (repo_root / "docker-compose.prod.yml").is_file()

    def test_container_env_matches_the_compose_service(self) -> None:
        """Both paths run the same image; they may not drift apart."""
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        compose = (LAUNCHER_JSON.parent.parent / "docker-compose.prod.yml").read_text(
            encoding="utf-8"
        )
        for key, value in cfg.container_env.items():
            if key == "ADAPTIVE_LEARNER_PORT":
                continue  # compose interpolates this one from the .env
            assert f"{key}={value}" in compose, f"{key} drifted from the compose service"


class TestClassicBuilderConstraint:
    """dockerfile mode builds via docker-py over the Engine API.

    That is the CLASSIC builder: multi-stage yes, BuildKit-only syntax no.
    A cache mount or a heredoc added here would not fail in CI (which has
    buildx) - it would fail on the end user's Docker 20.10 device, which is
    exactly the version chain this mode exists to remove.
    """

    BUILDKIT_ONLY = (
        "RUN --mount=",
        "COPY --link",
        "# syntax=",
        "--mount=type=cache",
        "--mount=type=secret",
        "--mount=type=bind",
    )

    def _dockerfiles(self) -> list[Path]:
        repo_root = LAUNCHER_JSON.parent.parent
        return [
            path
            for path in repo_root.rglob("Dockerfile*")
            if ".git" not in path.parts and "node_modules" not in path.parts
        ]

    def test_the_repo_has_dockerfiles_to_check(self) -> None:
        """A scanner that finds no files reports green for the wrong reason."""
        assert self._dockerfiles(), "no Dockerfile found - the scan proves nothing"

    def test_no_buildkit_only_syntax(self) -> None:
        offenders: list[str] = []
        for path in self._dockerfiles():
            text = path.read_text(encoding="utf-8")
            for lineno, line in enumerate(text.splitlines(), start=1):
                for marker in self.BUILDKIT_ONLY:
                    if marker in line:
                        offenders.append(f"{path}:{lineno}: {marker}")
        assert not offenders, "BuildKit-only syntax breaks the classic builder:\n" + "\n".join(
            offenders
        )

    def test_heredocs_are_absent(self) -> None:
        """`RUN <<EOF` needs BuildKit; the classic builder chokes on it."""
        import re

        pattern = re.compile(r"^\s*(RUN|COPY)\s+.*<<-?\s*\w+", re.MULTILINE)
        for path in self._dockerfiles():
            assert not pattern.search(path.read_text(encoding="utf-8")), f"heredoc in {path}"


class TestPermissionDeniedClassification:
    """0.21.0 (#2098): an EACCES socket is a PERMISSION problem, never "down".

    The device finding this guards is the Ubuntu one: Docker is running, the
    user is not in the ``docker`` group, and a launcher that reports "Docker
    is not started" sends them to restart a daemon that was never stopped.
    These run against the REAL installed docker-app-launcher classifier - a
    mocked classifier would only prove that the mock returns what it was told.
    """

    def test_bare_permission_error_is_classified_as_permission(self) -> None:
        from docker_app_launcher.docker import py_client

        assert py_client._classify_exception(PermissionError(13, "Permission denied")) == (
            "permission"
        )

    def test_permission_error_buried_in_args_is_still_found(self) -> None:
        """requests/urllib3 nest the real errno inside args, not __cause__."""
        from docker_app_launcher.docker import py_client

        buried = Exception(
            "Connection aborted.", PermissionError(13, "Permission denied")
        )
        assert py_client._classify_exception(buried) == "permission"

    def test_socket_absent_is_down_not_permission(self) -> None:
        """The counter-case: a missing socket must NOT read as a group problem."""
        import errno

        from docker_app_launcher.docker import py_client

        gone = ConnectionRefusedError(errno.ECONNREFUSED, "Connection refused")
        assert py_client._classify_exception(gone) == "down"

    @pytest.mark.skipif(
        not sys.platform.startswith("linux"),
        reason=(
            "unix-socket probe: Windows has no AF_UNIX, and the macOS runner's "
            "pytest tmp_path (/private/var/folders/...) blows the 104-char "
            "sun_path limit. The docker socket this guards is a Linux concern."
        ),
    )
    def test_ping_against_an_unreadable_socket_reports_permission(self) -> None:
        """End to end through ping(): a real chmod-000 socket path, no mocks."""
        import socket
        import stat
        import tempfile

        from docker_app_launcher.docker import py_client

        # NOT tmp_path: sun_path is capped at ~104 bytes, and pytest's
        # per-test directory names eat most of that budget.
        with tempfile.TemporaryDirectory(prefix="alsock") as tmp:
            sock_path = Path(tmp) / "d.sock"
            server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
            server.bind(str(sock_path))
            server.listen(1)
            try:
                sock_path.chmod(0o000)
                if os.access(sock_path, os.R_OK):  # root ignores the mode bits
                    pytest.skip("running as root - the mode bits do not deny us")
                status, detail = py_client.ping(f"unix://{sock_path}", timeout=2.0)
                assert status == "permission", f"got {status}: {detail}"
            finally:
                server.close()
                sock_path.chmod(stat.S_IRUSR | stat.S_IWUSR)


class TestDeploymentReadiness:
    """#2109: the mode's assets must resolve from the base actually used.

    The device failure was not a missing artifact. `~/adaptive-learner`
    held a complete source tree and the launcher still looked in
    `/tmp/_MEIxxxx/backend/Dockerfile`, because docker-app-launcher 0.21.0
    bases app-relative paths on the CONFIG FILE's directory (upstream #64)
    - which, frozen, is the bundle. A bundle-completeness check cannot see
    that: every file existed, just not where the resolution pointed.
    """

    def test_reports_what_it_checked(self) -> None:
        """Point 4 of the gate contract: a checker that measured nothing
        must not look like a clean one."""
        from adaptive_learner_launcher import deployment_assets

        report = deployment_assets.check(
            mode="dockerfile", base=Path("/nonexistent"), dockerfile="backend/Dockerfile"
        )
        assert report.checked, "the report names nothing it looked at"
        assert "backend/Dockerfile" in " ".join(report.checked)

    def test_missing_dockerfile_is_reported(self, tmp_path) -> None:
        from adaptive_learner_launcher import deployment_assets

        report = deployment_assets.check(
            mode="dockerfile", base=tmp_path, dockerfile="backend/Dockerfile"
        )
        assert not report.ok
        # Separator-agnostic: the report prints native paths, so Windows
        # says backend\\Dockerfile and Linux says backend/Dockerfile.
        assert any("backend" in miss and "Dockerfile" in miss for miss in report.missing)

    def test_complete_tree_is_ok(self, tmp_path) -> None:
        from adaptive_learner_launcher import deployment_assets

        (tmp_path / "backend").mkdir()
        (tmp_path / "backend" / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
        report = deployment_assets.check(
            mode="dockerfile", base=tmp_path, dockerfile="backend/Dockerfile"
        )
        assert report.ok, report.missing

    def test_compose_mode_checks_the_compose_file(self, tmp_path) -> None:
        from adaptive_learner_launcher import deployment_assets

        report = deployment_assets.check(
            mode="compose", base=tmp_path, compose_file="docker-compose.prod.yml"
        )
        assert not report.ok
        assert any("docker-compose.prod.yml" in miss for miss in report.missing)  # no separator

    def test_unknown_mode_fails_closed(self, tmp_path) -> None:
        """'I do not know this mode' may never read as 'nothing to check'."""
        from adaptive_learner_launcher import deployment_assets

        report = deployment_assets.check(mode="teleport", base=tmp_path)
        assert not report.ok
        assert any("teleport" in miss for miss in report.missing)

    def test_finds_the_tree_the_user_actually_has(self, tmp_path) -> None:
        """The diagnosis that makes the message actionable: the file exists,
        just not under the base the launcher will use."""
        from adaptive_learner_launcher import deployment_assets

        bundle = tmp_path / "bundle"
        real = tmp_path / "app"
        (real / "backend").mkdir(parents=True)
        (real / "backend" / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")
        bundle.mkdir()

        report = deployment_assets.check(
            mode="dockerfile",
            base=bundle,
            dockerfile="backend/Dockerfile",
            elsewhere=[real],
        )
        assert not report.ok
        assert report.found_elsewhere, "the alternative location was not reported"
        assert str(real) in " ".join(report.found_elsewhere)

    def test_launcher_json_mode_is_covered_by_the_manifest(self) -> None:
        """The shipped config's mode must be checkable, not just one mode."""
        from adaptive_learner_launcher import deployment_assets

        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        report = deployment_assets.check_config(cfg, base=LAUNCHER_JSON.parent.parent)
        assert report.ok, report.missing
        assert len(report.checked) >= 1

    def test_image_mode_without_archive_is_ready_anywhere(self, tmp_path) -> None:
        """No filesystem prerequisites: the image is pulled, not built.

        The check must still NAME that verdict (gate contract point 4) -
        an empty check list is a stated result, not a forgotten look.
        """
        from adaptive_learner_launcher import deployment_assets

        report = deployment_assets.check(mode="image", base=tmp_path / "empty-nonexistent")
        assert report.ok, report.missing
        assert report.checked, "the verdict must say what was (not) checked"

    def test_image_mode_with_missing_archive_is_reported(self, tmp_path) -> None:
        """upstream #78: a configured archive resolves against the base."""
        from adaptive_learner_launcher import deployment_assets

        report = deployment_assets.check(
            mode="image", base=tmp_path, image_archive="adaptive-learner-amd64.tar.gz"
        )
        assert not report.ok
        assert any("adaptive-learner-amd64.tar.gz" in miss for miss in report.missing)

    def test_image_mode_with_present_archive_is_ok(self, tmp_path) -> None:
        from adaptive_learner_launcher import deployment_assets

        (tmp_path / "adaptive-learner-amd64.tar.gz").write_bytes(b"stub")
        report = deployment_assets.check(
            mode="image", base=tmp_path, image_archive="adaptive-learner-amd64.tar.gz"
        )
        assert report.ok, report.missing
        assert "adaptive-learner-amd64.tar.gz" in " ".join(report.checked)


class TestReadinessMessage:
    """The message must name the real cause, not blame the config (#2109)."""

    def _bundle_with(self, tmp_path, **extra):
        bundle = tmp_path / "bundle"
        bundle.mkdir()
        (bundle / "launcher.json").write_text(
            json.dumps(
                {
                    "app_name": "Adaptive Learner",
                    "deployment_mode": "dockerfile",
                    "dockerfile_file": "backend/Dockerfile",
                    "build_context": ".",
                    **extra,
                }
            ),
            encoding="utf-8",
        )
        return bundle

    def test_bundle_config_no_longer_drags_the_base_into_the_bundle(
        self, monkeypatch, tmp_path
    ) -> None:
        """The #2109 device case: config in the bundle, tree on disk.

        Before the anchoring this resolved to _MEIxxxx/backend/Dockerfile
        and the install died. It must now resolve against the app tree.
        """
        bundle = self._bundle_with(tmp_path)
        tree = tmp_path / "app"
        (tree / "backend").mkdir(parents=True)
        (tree / "backend" / "Dockerfile").write_text("FROM scratch\n", encoding="utf-8")

        monkeypatch.setattr(__main__, "_config_path", lambda: bundle / "launcher.json")
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: tree)
        monkeypatch.setattr(__main__, "_bundle_root", lambda: None)
        seen: dict[str, list[str]] = {}
        monkeypatch.setattr(__main__, "_package_main", lambda a: seen.setdefault("args", a) and 0)

        assert __main__.main([]) == 0, "the GUI path must reach the package again"
        injected = Path(seen["args"][seen["args"].index("--config") + 1])
        assert json.loads(injected.read_text(encoding="utf-8"))["install_dir"] == str(tree)

    def test_missing_tree_produces_the_honest_diagnosis(
        self, monkeypatch, tmp_path, capsys
    ) -> None:
        """No action argument - the GUI path, which is where the device hit it."""
        bundle = self._bundle_with(tmp_path)
        empty = tmp_path / "empty"
        empty.mkdir()

        monkeypatch.setattr(__main__, "_config_path", lambda: bundle / "launcher.json")
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: empty)
        monkeypatch.setattr(__main__, "_bundle_root", lambda: None)
        called: list[list[str]] = []
        monkeypatch.setattr(__main__, "_package_main", lambda a: called.append(a) or 0)

        rc = __main__.main([])
        err = capsys.readouterr().err

        assert rc == 5, "an unrunnable mode must not report success"
        assert not called, "the package was invoked despite an unrunnable mode"
        normalised = err.replace("\\", "/")
        assert "backend/Dockerfile" in normalised
        assert "path-resolution bug" in err or "cannot run" in err

    def test_read_only_actions_still_work_on_a_broken_install(
        self, monkeypatch, tmp_path
    ) -> None:
        """--status / --stop / --uninstall must not be blocked by the guard."""
        bundle = self._bundle_with(tmp_path)
        empty = tmp_path / "empty"
        empty.mkdir()
        monkeypatch.setattr(__main__, "_config_path", lambda: bundle / "launcher.json")
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: empty)
        monkeypatch.setattr(__main__, "_bundle_root", lambda: None)
        seen: list[list[str]] = []
        monkeypatch.setattr(__main__, "_package_main", lambda a: seen.append(a) or 0)

        assert __main__.main(["--status"]) == 0
        assert seen, "the package must still be reached for a read-only action"

    def test_missing_config_is_left_to_the_package(self, monkeypatch, tmp_path) -> None:
        """Fail closed elsewhere: this guard does not swallow the #32 error."""
        monkeypatch.setattr(__main__, "_config_path", lambda: tmp_path / "gone.json")
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: None)
        monkeypatch.setattr(__main__, "_bundle_root", lambda: None)
        seen: list[list[str]] = []
        monkeypatch.setattr(__main__, "_package_main", lambda a: seen.append(a) or 7)

        assert __main__.main(["--install"]) == 7
        assert seen, "the package must still get its chance to report the missing config"


class TestDockerConfigSanitising:
    """#2126: a broken credential helper must not abort the build.

    docker-py enumerates EVERY configured registry before a build
    (`auth.py:285`), executing `docker-credential-<name>` for each. A
    leftover `credsStore: gcloud` with no binary raises StoreError - the
    CLI is lenient here, the SDK is not. The app needs no credentials at
    all: every FROM is a public library image.

    Blanking DOCKER_CONFIG would fix it and break something worse -
    `context/config.py:54` resolves the contexts directory relative to
    the config file, so the user's active context would silently vanish.
    """

    def _user_config(self, home, **extra):
        docker_dir = home / ".docker"
        (docker_dir / "contexts" / "meta").mkdir(parents=True)
        (docker_dir / "config.json").write_text(
            json.dumps(
                {
                    "credsStore": "gcloud",
                    "credHelpers": {"eu.gcr.io": "gcloud"},
                    "auths": {"registry.example.com": {"auth": "dXNlcjpwYXNz"}},
                    "currentContext": "desktop-linux",
                    "proxies": {"default": {"httpProxy": "http://proxy.invalid:3128"}},
                    **extra,
                }
            ),
            encoding="utf-8",
        )
        return docker_dir

    def test_credential_keys_are_dropped(self, tmp_path) -> None:
        from adaptive_learner_launcher import docker_config

        source = self._user_config(tmp_path)
        result = docker_config.sanitised_config_dir(tmp_path / "out", source=source)
        written = json.loads((result / "config.json").read_text(encoding="utf-8"))
        assert "credsStore" not in written
        assert "credHelpers" not in written
        assert "auths" not in written

    def test_the_active_context_survives(self, tmp_path) -> None:
        """Dropping the context would point the launcher at another daemon."""
        from adaptive_learner_launcher import docker_config

        source = self._user_config(tmp_path)
        result = docker_config.sanitised_config_dir(tmp_path / "out", source=source)
        written = json.loads((result / "config.json").read_text(encoding="utf-8"))
        assert written["currentContext"] == "desktop-linux"
        # contexts/ is resolved RELATIVE to the config file (context/config.py:54)
        assert (result / "contexts").exists()

    def test_proxies_are_carried_over(self, tmp_path) -> None:
        """Kept deliberately: the CLI reads them, docker-py does not."""
        from adaptive_learner_launcher import docker_config

        source = self._user_config(tmp_path)
        result = docker_config.sanitised_config_dir(tmp_path / "out", source=source)
        written = json.loads((result / "config.json").read_text(encoding="utf-8"))
        assert written["proxies"]["default"]["httpProxy"] == "http://proxy.invalid:3128"

    def test_reports_what_it_removed(self, tmp_path) -> None:
        """Point 4: the caller must be able to log what changed, not guess."""
        from adaptive_learner_launcher import docker_config

        source = self._user_config(tmp_path)
        report = docker_config.describe(source=source)
        assert "credsStore" in report
        assert "gcloud" in report

    def test_no_user_config_needs_no_sanitising(self, tmp_path) -> None:
        from adaptive_learner_launcher import docker_config

        assert docker_config.sanitised_config_dir(tmp_path / "out", source=tmp_path / "absent") is None

    def test_unreadable_config_is_not_silently_ignored(self, tmp_path) -> None:
        """Fail closed: a config we cannot parse must not read as 'nothing to do'."""
        from adaptive_learner_launcher import docker_config

        source = tmp_path / ".docker"
        source.mkdir()
        (source / "config.json").write_text("{not json", encoding="utf-8")
        with pytest.raises(ValueError):
            docker_config.sanitised_config_dir(tmp_path / "out", source=source)

    def test_the_real_thing_stops_raising(self, tmp_path, monkeypatch) -> None:
        """End to end through docker-py's own loader - no mock of the bug."""
        docker_auth = pytest.importorskip("docker.auth")
        source = self._user_config(tmp_path)

        monkeypatch.setenv("DOCKER_CONFIG", str(source))
        with pytest.raises(Exception) as raised:
            docker_auth.load_config().get_all_credentials()
        assert "docker-credential-gcloud" in str(raised.value), "the RED premise no longer holds"

        from adaptive_learner_launcher import docker_config

        clean = docker_config.sanitised_config_dir(tmp_path / "out", source=source)
        monkeypatch.setenv("DOCKER_CONFIG", str(clean))
        assert docker_auth.load_config().get_all_credentials() == {}


class TestVolumeNameMigration:
    """#2154: the compose volume carries the data, the plain one was empty.

    Compose prefixes with the project name, so the compose path created
    `adaptive-learner_adaptive-learner-data`, while launcher.json since
    #2100 declared the plain name - which docker-py takes literally and
    Docker creates silently. Users who installed in the compose era and
    then updated got an empty database while their projects and the Fernet
    secret.key sat in the other volume.
    """

    class _FakeVolumes:
        def __init__(self, present):
            self._present = present

        def get(self, name):
            if name not in self._present:
                raise RuntimeError("no such volume")
            return object()

    class _FakeContainers:
        def __init__(self, contents):
            self._contents = contents

        def run(self, image, command, volumes, remove):  # noqa: ARG002
            name = next(iter(volumes))
            return "\n".join(self._contents.get(name, [])).encode()

    class _FakeClient:
        def __init__(self, contents):
            self.volumes = TestVolumeNameMigration._FakeVolumes(set(contents))
            self.containers = TestVolumeNameMigration._FakeContainers(contents)

    def test_config_points_at_the_volume_that_holds_the_data(self) -> None:
        cfg = LauncherConfig.from_json(LAUNCHER_JSON)
        assert cfg.container_volumes == {"adaptive-learner_adaptive-learner-data": "/app/data"}

    def test_no_conflict_when_only_the_compose_volume_has_data(self) -> None:
        from adaptive_learner_launcher import volume_migration

        client = self._FakeClient({"adaptive-learner_adaptive-learner-data": ["adaptive_learner.db"]})
        assert volume_migration.describe_conflict(client) is None

    def test_no_conflict_when_the_second_volume_is_empty(self) -> None:
        from adaptive_learner_launcher import volume_migration

        client = self._FakeClient(
            {
                "adaptive-learner_adaptive-learner-data": ["adaptive_learner.db"],
                "adaptive-learner-data": [],
            }
        )
        assert volume_migration.describe_conflict(client) is None

    def test_lost_found_alone_is_not_data(self) -> None:
        """An empty ext4 volume is not somebody's learning history."""
        from adaptive_learner_launcher import volume_migration

        client = self._FakeClient(
            {
                "adaptive-learner_adaptive-learner-data": ["adaptive_learner.db"],
                "adaptive-learner-data": ["lost+found"],
            }
        )
        assert volume_migration.describe_conflict(client) is None

    def test_both_with_data_stops_and_names_both(self) -> None:
        """The one case where every choice loses something."""
        from adaptive_learner_launcher import volume_migration

        client = self._FakeClient(
            {
                "adaptive-learner_adaptive-learner-data": ["adaptive_learner.db", ".config"],
                "adaptive-learner-data": ["adaptive_learner.db"],
            }
        )
        message = volume_migration.describe_conflict(client)
        assert message is not None
        assert "adaptive-learner_adaptive-learner-data" in message
        assert "adaptive-learner-data" in message
        assert "your call, not the program's" in message
        # It must hand over the read-only inspection commands, not just a verdict.
        assert "-v adaptive-learner_adaptive-learner-data:/d:ro" in message

    def test_it_says_browser_mode_is_unaffected(self) -> None:
        """Scoping matters for the reader: Dexie data never lived here."""
        from adaptive_learner_launcher import volume_migration

        client = self._FakeClient(
            {
                "adaptive-learner_adaptive-learner-data": ["adaptive_learner.db"],
                "adaptive-learner-data": ["adaptive_learner.db"],
            }
        )
        assert "Browser-storage mode is unaffected" in volume_migration.describe_conflict(client)


class TestComposeNameCoverage:
    """#2154 structurally: every declared resource name vs what compose makes.

    Compose prefixes VOLUMES and NETWORKS with the project name but leaves
    an explicit `container_name` alone. One field already diverged
    silently; this walks all of them so the next one cannot.
    """

    def _compose(self) -> str:
        return (LAUNCHER_JSON.parent.parent / "docker-compose.prod.yml").read_text(encoding="utf-8")

    def test_it_examines_every_declared_name(self) -> None:
        """Point 4: an empty scan must not read as a clean one."""
        cfg = json.loads(LAUNCHER_JSON.read_text(encoding="utf-8"))
        declared = {
            key: cfg.get(key)
            for key in ("container_name", "image_name", "compose_project", "container_volumes")
            if cfg.get(key)
        }
        print(f"examined {len(declared)} declared resource name(s): {', '.join(declared)}")
        assert len(declared) >= 3

    def test_volume_names_match_what_compose_creates(self) -> None:
        cfg = json.loads(LAUNCHER_JSON.read_text(encoding="utf-8"))
        project = cfg["compose_project"]
        compose = self._compose()
        for declared in cfg.get("container_volumes", {}):
            # The compose file declares the UNPREFIXED name; docker creates
            # "<project>_<name>". So the launcher must declare the prefixed one.
            assert declared.startswith(f"{project}_"), (
                f"{declared} is not what compose creates - it would mount a "
                f"different, empty volume (#2154)"
            )
            bare = declared[len(project) + 1 :]
            assert f"  {bare}:" in compose, f"{bare} is not declared in the compose file"

    def test_no_network_is_declared_yet_and_that_is_deliberate(self) -> None:
        """The same prefixing applies to networks - none exist, so none can drift."""
        cfg = json.loads(LAUNCHER_JSON.read_text(encoding="utf-8"))
        assert "container_networks" not in cfg, (
            "a declared network would need the same project prefix (#2154)"
        )
        assert "networks:" not in self._compose(), "the compose file grew a network - re-check the prefixes"

    def test_container_name_is_not_prefixed(self) -> None:
        """Compose does NOT prefix an explicit container_name - proof it is
        the volumes that need the prefix, not everything.

        Since #2122 the compose value interpolates
        (``${ADAPTIVE_LEARNER_CONTAINER_NAME:-<default>}``); the DEFAULT is
        what an env-less install resolves, so it must equal the launcher's
        container_name."""
        cfg = json.loads(LAUNCHER_JSON.read_text(encoding="utf-8"))
        name = cfg["container_name"]
        match = re.search(r"container_name:\s*(.+)", self._compose())
        assert match is not None, "compose file lost its container_name line"
        value = match.group(1).strip()
        assert value in (name, f"${{ADAPTIVE_LEARNER_CONTAINER_NAME:-{name}}}"), (
            f"compose container_name {value!r} does not resolve to {name!r} by default"
        )


class TestImageModeStandalone:
    """#2110 Teil 4: image mode needs no source tree, so no download.

    The #2054 bootstrap exists only because dockerfile/compose need a
    build context. A frozen image-mode run anchors in the launcher's
    config dir instead - stable, writable, and the same across runs, so
    the stored port and the anchored config land where the next run
    reads them.
    """

    def _image_config(self, tmp_path: Path) -> Path:
        cfg = tmp_path / "launcher.json"
        cfg.write_text(
            json.dumps(
                {
                    "app_name": "X",
                    "app_version": "9.9.9",
                    "deployment_mode": "image",
                    "image_reference": "ghcr.io/astrapi69/adaptive-learner:9.9.9",
                    "config_dir": str(tmp_path / "anchor"),
                }
            ),
            encoding="utf-8",
        )
        return cfg

    def test_frozen_image_mode_never_downloads_the_source_tree(
        self, monkeypatch, tmp_path
    ) -> None:
        cfg = self._image_config(tmp_path)
        bundle = tmp_path / "bundle"
        _fill_bundle(bundle)
        monkeypatch.setattr(__main__, "_config_path", lambda: cfg)
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(bundle), raising=False)
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: None)
        start_cwd = tmp_path / "elsewhere"
        start_cwd.mkdir()
        monkeypatch.chdir(start_cwd)

        def boom(url, timeout=60.0):  # pragma: no cover
            raise AssertionError("image mode must not download a source tree")

        monkeypatch.setattr(__main__, "_download", boom)
        seen: dict[str, Path] = {}

        def fake_package_main(args):
            seen["cwd"] = Path.cwd()
            return 0

        monkeypatch.setattr(__main__, "_package_main", fake_package_main)
        assert __main__.main(["--status"]) == 0
        assert seen["cwd"] == tmp_path / "anchor"
        assert (tmp_path / "anchor").is_dir(), "the anchor dir must be created"

    def test_dockerfile_mode_still_bootstraps(self, monkeypatch, tmp_path) -> None:
        """The guard is mode-scoped: the #2054 path stays for the source modes."""
        cfg = tmp_path / "launcher.json"
        cfg.write_text(
            json.dumps(
                {"app_name": "X", "app_version": "9.9.9", "deployment_mode": "dockerfile"}
            ),
            encoding="utf-8",
        )
        bundle = tmp_path / "bundle"
        _fill_bundle(bundle)
        monkeypatch.setattr(__main__, "_config_path", lambda: cfg)
        monkeypatch.setattr(__main__.sys, "frozen", True, raising=False)
        monkeypatch.setattr(__main__.sys, "_MEIPASS", str(bundle), raising=False)
        monkeypatch.setattr(__main__, "_resolve_app_dir", lambda: None)
        start_cwd = tmp_path / "elsewhere"
        start_cwd.mkdir()
        monkeypatch.chdir(start_cwd)
        attempted: list[str] = []

        def offline(url, timeout=60.0):
            attempted.append(url)
            raise OSError("network unreachable")

        monkeypatch.setattr(__main__, "_download", offline)
        assert __main__.main(["--status"]) == 4
        assert attempted, "dockerfile mode without a tree must still try the bootstrap"


class TestSyncVersionsLauncherJson:
    """The image_reference tag is a version pin and may not drift (#2110).

    Same class as app_version: hand-editing is the stale-pin bug the
    sync tooling exists to prevent; `sync_versions.py --check` (run by
    verify_version_pins.sh and the release gate) must flag a drifted tag.
    """

    def _sync_module(self):
        import importlib.util

        script = LAUNCHER_JSON.parent.parent / "scripts" / "sync_versions.py"
        spec = importlib.util.spec_from_file_location("sync_versions_under_test", script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def _stale_config(self, tmp_path: Path) -> Path:
        target = tmp_path / "launcher.json"
        target.write_text(
            json.dumps(
                {
                    "app_version": "1.0.0",
                    "image_reference": "ghcr.io/astrapi69/adaptive-learner:1.0.0",
                    "other": "untouched",
                },
                indent=2,
            ),
            encoding="utf-8",
        )
        return target

    def test_both_version_fields_are_rewritten(self, tmp_path) -> None:
        sync = self._sync_module()
        target = self._stale_config(tmp_path)
        assert sync.update_launcher_json_app_version(target, "9.9.9", False) is True
        written = json.loads(target.read_text(encoding="utf-8"))
        assert written["app_version"] == "9.9.9"
        assert written["image_reference"] == "ghcr.io/astrapi69/adaptive-learner:9.9.9"
        assert written["other"] == "untouched"

    def test_dry_run_reports_but_writes_nothing(self, tmp_path) -> None:
        sync = self._sync_module()
        target = self._stale_config(tmp_path)
        before = target.read_text(encoding="utf-8")
        assert sync.update_launcher_json_app_version(target, "9.9.9", True) is True
        assert target.read_text(encoding="utf-8") == before

    def test_current_versions_are_a_no_op(self, tmp_path) -> None:
        sync = self._sync_module()
        target = self._stale_config(tmp_path)
        assert sync.update_launcher_json_app_version(target, "1.0.0", False) is False

    def test_shipped_launcher_json_is_in_lock_step(self) -> None:
        """The artifact-level pin: the committed tag equals the app version."""
        sync = self._sync_module()
        assert (
            sync.update_launcher_json_app_version(LAUNCHER_JSON, __version__, True) is False
        ), "launcher.json version fields drifted from the canonical version"


class TestFailSoftIsNamed:
    """Fail-soft paths must say WHY, or 'nothing found' and 'could not
    look' read identically (the claimed-enforcement-without-enforcement
    class; code-hygiene.md: never swallow an exception silently)."""

    def test_unreadable_bundled_config_warns_and_defaults(
        self, monkeypatch, tmp_path, capsys
    ) -> None:
        missing = tmp_path / "gone.json"
        monkeypatch.setattr(__main__, "_config_path", lambda: missing)
        assert __main__._bundled_config_raw() == {}
        err = capsys.readouterr().err
        assert "gone.json" in err
        assert "compose-era defaults" in err

    def test_malformed_bundled_config_warns_and_defaults(
        self, monkeypatch, tmp_path, capsys
    ) -> None:
        bad = tmp_path / "launcher.json"
        bad.write_text("{not json", encoding="utf-8")
        monkeypatch.setattr(__main__, "_config_path", lambda: bad)
        assert __main__._bundled_config_raw() == {}
        assert "not valid JSON" in capsys.readouterr().err

    def test_non_object_bundled_config_warns_and_defaults(
        self, monkeypatch, tmp_path, capsys
    ) -> None:
        bad = tmp_path / "launcher.json"
        bad.write_text('["a", "list"]', encoding="utf-8")
        monkeypatch.setattr(__main__, "_config_path", lambda: bad)
        assert __main__._bundled_config_raw() == {}
        assert "JSON object" in capsys.readouterr().err

    def test_uncreatable_anchor_warns_and_falls_back_to_cwd(
        self, monkeypatch, tmp_path, capsys
    ) -> None:
        blocker = tmp_path / "blocker"
        blocker.write_text("a file, not a dir", encoding="utf-8")
        cfg = tmp_path / "launcher.json"
        cfg.write_text(
            json.dumps(
                {"deployment_mode": "image", "config_dir": str(blocker / "sub")}
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(__main__, "_config_path", lambda: cfg)
        workdir = tmp_path / "workdir"
        workdir.mkdir()
        monkeypatch.chdir(workdir)
        assert __main__._image_mode_anchor() == workdir
        err = capsys.readouterr().err
        assert "cannot create" in err
        assert str(workdir) in err

    def test_broken_conflict_guard_warns_instead_of_vanishing(
        self, monkeypatch, capsys
    ) -> None:
        class _Client:
            pass

        fake_docker = type(sys)("docker")
        fake_docker.from_env = lambda timeout=30: _Client()
        monkeypatch.setitem(sys.modules, "docker", fake_docker)

        def boom(client):
            raise RuntimeError("probe container failed")

        monkeypatch.setattr(__main__.volume_migration, "describe_conflict", boom)
        assert __main__._volume_conflict() is None
        err = capsys.readouterr().err
        assert "volume-conflict guard could not run" in err
        assert "probe container failed" in err

    def test_unwritable_app_dir_warns_and_uses_bundled_config(
        self, monkeypatch, tmp_path, capsys
    ) -> None:
        import os as _os
        import stat as _stat

        source = tmp_path / "launcher.json"
        source.write_text(json.dumps({"app_name": "X"}), encoding="utf-8")
        monkeypatch.setattr(__main__, "_config_path", lambda: source)
        locked = tmp_path / "locked"
        locked.mkdir()
        locked.chmod(_stat.S_IRUSR | _stat.S_IXUSR)
        if _os.access(locked, _os.W_OK):  # root ignores the mode bits
            pytest.skip("running as root - the mode bits do not deny us")
        try:
            assert __main__._anchored_config_path(locked) == source
            assert "could not write the anchored config" in capsys.readouterr().err
        finally:
            locked.chmod(_stat.S_IRWXU)
