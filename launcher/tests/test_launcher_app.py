"""Tests for the persistent launcher window's pure logic. No Tk needed.

The Tk shell (LauncherApp) is verified manually on a real device per the
quality rules; here we pin the state->layout mapping, the port-field
editability, and the action dispatch (mocking the actions layer).
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from adaptive_learner_launcher import launcher_app


class TestNeverClosesItself:
    """The single window may ONLY be closed by its X (WM_DELETE_WINDOW);
    no programmatic root close anywhere (#984)."""

    def test_no_programmatic_root_close(self) -> None:
        src = Path(launcher_app.__file__).read_text(encoding="utf-8")
        for forbidden in ("_root.destroy", "_root.quit", "_root.close", "self.close("):
            assert forbidden not in src, (
                f"{forbidden} found in launcher_app - only the X button may "
                "close the window (#984)"
            )


class TestPortEditable:
    def test_editable_before_running(self) -> None:
        assert launcher_app.port_editable("not_installed") is True
        assert launcher_app.port_editable("stopped") is True

    def test_readonly_when_running_or_no_docker(self) -> None:
        assert launcher_app.port_editable("running") is False
        assert launcher_app.port_editable("no_docker") is False


class TestButtonsForState:
    def test_not_installed(self) -> None:
        # No cancel/close button: only the window X closes it (#984).
        ids = [a for a, _ in launcher_app.buttons_for_state("not_installed")]
        assert ids == ["install"]

    def test_no_state_offers_a_close_button(self) -> None:
        for state in ("no_docker", "not_installed", "running", "stopped"):
            ids = [a for a, _ in launcher_app.buttons_for_state(state)]
            assert not ({"cancel", "close", "quit"} & set(ids))

    def test_running(self) -> None:
        ids = [a for a, _ in launcher_app.buttons_for_state("running")]
        assert ids == ["open", "stop", "uninstall"]

    def test_stopped(self) -> None:
        ids = [a for a, _ in launcher_app.buttons_for_state("stopped")]
        assert ids == ["start", "uninstall"]

    def test_no_docker(self) -> None:
        ids = [a for a, _ in launcher_app.buttons_for_state("no_docker")]
        assert ids == ["recheck"]

    def test_unknown_state_no_buttons(self) -> None:
        assert launcher_app.buttons_for_state("???") == []


class TestDispatchAction:
    _CTX = {"compose_file": "c.yml", "project": "adaptive-learner", "port": 8501}

    def test_install_routes_to_actions(self) -> None:
        with patch.object(launcher_app.actions, "install", return_value=(True, "ok")) as m:
            assert launcher_app.dispatch_action("install", **self._CTX) == (True, "ok")
        m.assert_called_once()

    def test_start_routes_to_actions(self) -> None:
        with patch.object(launcher_app.actions, "start", return_value=(True, "ok")) as m:
            launcher_app.dispatch_action("start", **self._CTX)
        m.assert_called_once()

    def test_stop_routes_to_actions(self) -> None:
        with patch.object(launcher_app.actions, "stop", return_value=(True, "ok")) as m:
            launcher_app.dispatch_action("stop", **self._CTX)
        m.assert_called_once()

    def test_uninstall_routes_to_actions(self) -> None:
        with patch.object(launcher_app.actions, "uninstall", return_value=(True, "ok")) as m:
            launcher_app.dispatch_action("uninstall", **self._CTX)
        m.assert_called_once()

    def test_open_calls_browser_returns_none(self) -> None:
        with patch.object(launcher_app.actions, "open_browser") as m:
            assert launcher_app.dispatch_action("open", **self._CTX) is None
        m.assert_called_once_with(8501)

    def test_cancel_and_recheck_are_noop(self) -> None:
        assert launcher_app.dispatch_action("cancel", **self._CTX) is None
        assert launcher_app.dispatch_action("recheck", **self._CTX) is None

    def test_unknown_action_returns_none(self) -> None:
        assert launcher_app.dispatch_action("frobnicate", **self._CTX) is None
