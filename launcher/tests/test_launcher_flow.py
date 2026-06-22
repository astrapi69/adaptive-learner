"""Tests for the launcher orchestration helpers added for #942.

Covers CLI port parsing, port-conflict resolution (Bug 3), the
Docker-first readiness gate (Bug 1) and the installed-app management
menu (Bug 5). The Tk ``StatusWindow`` is replaced by a fake that runs
the background worker synchronously so no event loop is needed.
"""

from __future__ import annotations

import re
from pathlib import Path
from unittest.mock import patch

import pytest

from adaptive_learner_launcher import __main__ as main_mod
from adaptive_learner_launcher import ui as ui_mod

# Captured at import time, BEFORE the autouse fixture below patches
# ``ui.StatusWindow`` with a test stub. The contract test must check the
# real class, not the stub.
_REAL_STATUS_WINDOW = ui_mod.StatusWindow


class _FakeStatusWindow:
    """Minimal StatusWindow stand-in: runs the worker inline, no Tk."""

    def __init__(self, *args, **kwargs) -> None:
        self.steps: list[str] = []

    def set_steps(self, labels: list[str]) -> None:
        self.steps = labels

    def start_step(self, *_a, **_k) -> None: ...
    def complete_step(self, *_a, **_k) -> None: ...
    def fail_step(self, *_a, **_k) -> None: ...
    def set_error(self, *_a, **_k) -> None: ...
    def close(self) -> None: ...
    def run_mainloop(self) -> None: ...

    def after(self, _delay, callback=None) -> None:
        if callable(callback):
            callback()

    def run_in_background(self, target, *args):
        target(*args)


@pytest.fixture(autouse=True)
def _fake_status_window():
    with patch.object(main_mod.ui, "StatusWindow", _FakeStatusWindow):
        yield


class TestParseCliPort:

    def test_valid_port(self) -> None:
        assert main_mod._parse_cli_port(["--port", "8501"]) == 8501

    def test_no_args(self) -> None:
        assert main_mod._parse_cli_port([]) is None

    def test_out_of_range_ignored(self) -> None:
        assert main_mod._parse_cli_port(["--port", "0"]) is None
        assert main_mod._parse_cli_port(["--port", "70000"]) is None

    def test_unknown_flag_ignored(self) -> None:
        assert main_mod._parse_cli_port(["--banana", "x"]) is None


class TestParseCliDebug:

    def test_debug_flag_set(self) -> None:
        assert main_mod._parse_cli_debug(["--debug"]) is True

    def test_debug_with_port(self) -> None:
        assert main_mod._parse_cli_debug(["--port", "8501", "--debug"]) is True

    def test_no_debug(self) -> None:
        assert main_mod._parse_cli_debug([]) is False

    def test_unknown_flag_ignored(self) -> None:
        assert main_mod._parse_cli_debug(["--banana"]) is False


class TestMaybeShowHelp:

    def test_help_long_flag(self, capsys) -> None:
        assert main_mod._maybe_show_help(["--help"]) is True
        out = capsys.readouterr().out
        assert "--port" in out and "--debug" in out

    def test_help_short_flag(self, capsys) -> None:
        assert main_mod._maybe_show_help(["-h"]) is True

    def test_no_help(self) -> None:
        assert main_mod._maybe_show_help(["--debug"]) is False
        assert main_mod._maybe_show_help([]) is False


class TestReleaseLinks:
    """The release/download page links must target the correct repo and
    the stable /releases/latest page (#952)."""

    def test_release_page_url_is_latest_on_correct_repo(self) -> None:
        assert (
            main_mod.RELEASE_PAGE_URL
            == "https://github.com/astrapi69/adaptive-learner/releases/latest"
        )

    def test_no_underscore_slug_in_main_urls(self) -> None:
        source = Path(main_mod.__file__).read_text(encoding="utf-8")
        assert "astrapi69/adaptive_learner" not in source

    def test_stale_dialog_download_opens_release_page(self) -> None:
        with (
            patch.object(
                main_mod.update_check, "fetch_latest_version",
                return_value=("v999.0.0", "https://example.invalid/whatever"),
            ),
            patch.object(main_mod.update_check, "is_newer", return_value=True),
            patch.object(main_mod.ui, "three_button_dialog", return_value="primary"),
            patch.object(main_mod.webbrowser, "open") as open_mock,
        ):
            assert main_mod._check_launcher_target_stale() is False
        open_mock.assert_called_once_with(main_mod.RELEASE_PAGE_URL)

    def test_update_notification_opens_release_page(self) -> None:
        with (
            patch.object(main_mod.ui, "three_button_dialog", return_value="primary"),
            patch.object(main_mod.webbrowser, "open") as open_mock,
        ):
            main_mod._show_update_notification("v999.0.0", "https://example.invalid/x", "1.0.0")
        open_mock.assert_called_once_with(main_mod.RELEASE_PAGE_URL)


class TestStatusWindowContract:
    """Pin the ``__main__`` -> ``StatusWindow`` method contract.

    ``StatusWindow`` wraps ``tk.Tk`` by composition (no inheritance), so a
    Tk method such as ``destroy`` is NOT automatically available — the
    public teardown method is ``close``. Calling ``window.destroy()``
    crashed the launcher on a real device (#948). This test fails if
    ``__main__`` ever calls a ``window`` method that the real
    ``StatusWindow`` does not provide.
    """

    def test_every_window_call_exists_on_status_window(self) -> None:
        source = Path(main_mod.__file__).read_text(encoding="utf-8")
        called = set(re.findall(r"\bwindow\.([a-z_][a-z0-9_]*)", source))
        assert called, "expected to find window.* calls in __main__"
        missing = sorted(
            name for name in called if not hasattr(_REAL_STATUS_WINDOW, name)
        )
        assert not missing, (
            f"__main__ calls window methods not on StatusWindow: {missing}. "
            "Add the method to StatusWindow or use an existing one "
            "(e.g. close() instead of destroy())."
        )

    def test_destroy_is_not_called(self) -> None:
        source = Path(main_mod.__file__).read_text(encoding="utf-8")
        assert "window.destroy" not in source, (
            "StatusWindow has no destroy(); use window.close() (#948)."
        )

    def test_status_window_exposes_close_not_destroy(self) -> None:
        assert hasattr(_REAL_STATUS_WINDOW, "close")
        assert not hasattr(_REAL_STATUS_WINDOW, "destroy")


class TestResolveFreePort:

    def test_returns_port_when_available(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.config, "resolve_launch_port", return_value=7880),
            patch.object(main_mod.ports, "is_available", return_value=True),
        ):
            assert main_mod._resolve_free_port(tmp_path, None) == 7880

    def test_suggests_and_persists_free_port_on_conflict(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.config, "resolve_launch_port", return_value=7880),
            patch.object(main_mod.ports, "is_available", return_value=False),
            patch.object(main_mod.ports, "find_available", return_value=7881),
            patch.object(main_mod.ui, "two_button_dialog", return_value="primary"),
            patch.object(main_mod.config, "write_public_port") as write_mock,
        ):
            assert main_mod._resolve_free_port(tmp_path, None) == 7881
        write_mock.assert_called_once_with(tmp_path, 7881)

    def test_returns_none_when_user_cancels(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.config, "resolve_launch_port", return_value=7880),
            patch.object(main_mod.ports, "is_available", return_value=False),
            patch.object(main_mod.ports, "find_available", return_value=7881),
            patch.object(main_mod.ui, "two_button_dialog", return_value="secondary"),
            patch.object(main_mod.config, "write_public_port") as write_mock,
        ):
            assert main_mod._resolve_free_port(tmp_path, None) is None
        write_mock.assert_not_called()

    def test_returns_none_when_no_free_port(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.config, "resolve_launch_port", return_value=65535),
            patch.object(main_mod.ports, "is_available", return_value=False),
            patch.object(main_mod.ports, "find_available", return_value=None),
            patch.object(main_mod.ui, "error_box") as error_mock,
        ):
            assert main_mod._resolve_free_port(tmp_path, None) is None
        error_mock.assert_called_once()


class TestEnsureDockerReady:

    def test_false_when_not_installed(self) -> None:
        with (
            patch.object(main_mod.docker, "docker_installed", return_value=(False, "no")),
            patch.object(main_mod.ui, "three_button_dialog", return_value="cancel"),
            patch.object(main_mod, "_open_url"),
        ):
            assert main_mod._ensure_docker_ready(False) is False

    def test_true_when_daemon_running(self) -> None:
        with (
            patch.object(main_mod.docker, "docker_installed", return_value=(True, "v")),
            patch.object(main_mod.docker, "docker_daemon_running", return_value=(True, "ok")),
        ):
            assert main_mod._ensure_docker_ready(False) is True

    def test_cancel_on_daemon_dialog_aborts(self) -> None:
        with (
            patch.object(main_mod.docker, "docker_installed", return_value=(True, "v")),
            patch.object(main_mod.docker, "docker_daemon_running", return_value=(False, "down")),
            patch.object(main_mod.ui, "three_button_dialog", return_value="cancel"),
        ):
            assert main_mod._ensure_docker_ready(False) is False

    def test_start_button_then_daemon_comes_up(self) -> None:
        with (
            patch.object(main_mod.docker, "docker_installed", return_value=(True, "v")),
            patch.object(main_mod.docker, "docker_daemon_running", return_value=(False, "down")),
            patch.object(main_mod.ui, "three_button_dialog", return_value="primary"),
            patch.object(main_mod.docker, "start_docker_desktop", return_value=(True, "started")),
            patch.object(main_mod, "_wait_for_daemon", return_value=True),
        ):
            assert main_mod._ensure_docker_ready(False) is True


class TestManageRunning:

    def test_open_opens_browser(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.ui, "choice_dialog", return_value="open"),
            patch.object(main_mod, "_open_url") as open_mock,
        ):
            assert main_mod._manage_running(tmp_path, 7880) == 0
        open_mock.assert_called_once()
        assert "7880" in open_mock.call_args[0][0]

    def test_stop_calls_stop_stack(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.ui, "choice_dialog", return_value="stop"),
            patch.object(main_mod, "_stop_stack") as stop_mock,
        ):
            assert main_mod._manage_running(tmp_path, 7880) == 0
        stop_mock.assert_called_once_with(tmp_path)

    def test_uninstall_then_done(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.ui, "choice_dialog", return_value="uninstall"),
            patch.object(main_mod, "_quick_uninstall", return_value=True) as uninstall_mock,
        ):
            assert main_mod._manage_running(tmp_path, 7880) == 0
        uninstall_mock.assert_called_once_with(tmp_path)

    def test_closing_menu_is_noop(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.ui, "choice_dialog", return_value=None),
            patch.object(main_mod, "_open_url") as open_mock,
            patch.object(main_mod, "_stop_stack") as stop_mock,
        ):
            assert main_mod._manage_running(tmp_path, 7880) == 0
        open_mock.assert_not_called()
        stop_mock.assert_not_called()

    def test_uninstall_cancel_loops_back(self, tmp_path: Path) -> None:
        # First choice uninstall (cancelled), then close the menu.
        with (
            patch.object(main_mod.ui, "choice_dialog", side_effect=["uninstall", None]),
            patch.object(main_mod, "_quick_uninstall", return_value=False) as uninstall_mock,
        ):
            assert main_mod._manage_running(tmp_path, 7880) == 0
        assert uninstall_mock.call_count == 1


class TestOfferStartOrUninstall:

    def test_start_returns_true(self, tmp_path: Path) -> None:
        with patch.object(main_mod.ui, "choice_dialog", return_value="start"):
            assert main_mod._offer_start_or_uninstall(tmp_path) is True

    def test_uninstall_returns_false_and_uninstalls(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.ui, "choice_dialog", return_value="uninstall"),
            patch.object(main_mod, "_quick_uninstall", return_value=True) as uninstall_mock,
        ):
            assert main_mod._offer_start_or_uninstall(tmp_path) is False
        uninstall_mock.assert_called_once_with(tmp_path)

    def test_close_returns_false(self, tmp_path: Path) -> None:
        with patch.object(main_mod.ui, "choice_dialog", return_value=None):
            assert main_mod._offer_start_or_uninstall(tmp_path) is False


class TestQuickUninstall:

    def test_cancel_does_nothing(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.ui, "two_button_dialog", return_value="secondary"),
            patch.object(main_mod.docker, "compose_down") as down_mock,
        ):
            assert main_mod._quick_uninstall(tmp_path) is False
        down_mock.assert_not_called()

    def test_confirm_removes_containers_and_images_but_keeps_volumes(self, tmp_path: Path) -> None:
        with (
            patch.object(main_mod.ui, "two_button_dialog", return_value="primary"),
            patch.object(main_mod.docker, "compose_down", return_value=(True, "")) as down_mock,
            patch.object(main_mod.docker, "remove_images", return_value=(True, "")) as images_mock,
            patch.object(main_mod.docker, "remove_volumes") as volumes_mock,
            patch.object(main_mod, "_remove_desktop_shortcut"),
        ):
            assert main_mod._quick_uninstall(tmp_path) is True
        down_mock.assert_called_once()
        images_mock.assert_called_once()
        volumes_mock.assert_not_called()  # data is preserved


class TestStackStateBranch:
    """``_run_launcher`` routes to the management menu based on stack state."""

    def _common_patches(self, tmp_path: Path):
        return (
            patch.object(main_mod, "_retry_pending_cleanup"),
            patch.object(main_mod, "_ensure_docker_ready", return_value=True),
            patch.object(main_mod.settings, "get", return_value=True),
            patch.object(main_mod.config, "get_show_details_default", return_value=False),
            patch.object(main_mod.manifest, "read_manifest", return_value={"install_dir": str(tmp_path), "version": "1.0.0"}),
            patch.object(main_mod.config, "is_valid_repo", return_value=True),
            patch.object(main_mod, "_ensure_env_file", return_value=(True, "ok")),
            patch.object(main_mod.config, "resolve_launch_port", return_value=7880),
        )

    def test_running_routes_to_manage_running(self, tmp_path: Path) -> None:
        patches = self._common_patches(tmp_path)
        with patches[0], patches[1], patches[2], patches[3], patches[4], patches[5], patches[6], patches[7], \
             patch.object(main_mod.docker, "stack_running", return_value=True), \
             patch.object(main_mod, "_manage_running", return_value=0) as manage_mock:
            rc = main_mod._run_launcher()
        assert rc == 0
        manage_mock.assert_called_once_with(tmp_path, 7880)

    def test_stopped_uninstall_choice_exits(self, tmp_path: Path) -> None:
        patches = self._common_patches(tmp_path)
        with patches[0], patches[1], patches[2], patches[3], patches[4], patches[5], patches[6], patches[7], \
             patch.object(main_mod.docker, "stack_running", return_value=False), \
             patch.object(main_mod, "_offer_start_or_uninstall", return_value=False), \
             patch.object(main_mod, "_resolve_free_port") as resolve_mock:
            rc = main_mod._run_launcher()
        assert rc == 0
        resolve_mock.assert_not_called()  # did not proceed to start
