"""Tests for the persistent launcher window's pure logic. No Tk needed.

The Tk shell (LauncherApp) is verified manually on a real device per the
quality rules; here we pin the state->layout mapping, the port-field
editability, and the action dispatch (mocking the actions layer).
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from adaptive_learner_launcher import launcher_app


class TestCloseAffordance:
    """Closing is driven by the X / tray, never an in-window button.

    #984 forbade an in-window cancel/close BUTTON (the window must stay
    persistent). #987 added the legitimate programmatic close path: the
    WM_DELETE_WINDOW handler ``_on_close`` (X when the app is not running)
    and the tray "Quit" action both funnel through ``_quit``.
    """

    def test_close_funnels_through_single_quit(self) -> None:
        src = Path(launcher_app.__file__).read_text(encoding="utf-8")
        # Exactly one root teardown, in the deliberate _quit handler.
        assert src.count("self._root.destroy()") == 1, (
            "the window must be destroyed from exactly one place (_quit); "
            "every close path funnels through it (#984/#987)"
        )
        assert "self._root.quit(" not in src
        # No close-and-reopen helper that an in-window button could call.
        assert "self.close(" not in src

    def test_no_state_offers_an_in_window_close_button(self) -> None:
        for state in ("no_docker", "not_installed", "running", "stopped"):
            ids = [a for a, _ in launcher_app.buttons_for_state(state)]
            assert not ({"cancel", "close", "quit"} & set(ids)), (
                f"state {state} must not expose an in-window close button (#984)"
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


class TestShouldMinimizeToTray:
    """Minimize to tray ONLY when running AND the tray extra is available (#987)."""

    def test_running_with_tray(self) -> None:
        assert launcher_app.should_minimize_to_tray("running", tray_available=True) is True

    def test_running_without_tray_closes(self) -> None:
        assert launcher_app.should_minimize_to_tray("running", tray_available=False) is False

    def test_stopped_always_closes(self) -> None:
        assert launcher_app.should_minimize_to_tray("stopped", tray_available=True) is False
        assert launcher_app.should_minimize_to_tray("not_installed", tray_available=True) is False
        assert launcher_app.should_minimize_to_tray("no_docker", tray_available=True) is False


class TestTrayMenuLabels:
    def test_has_every_menu_action(self) -> None:
        labels = launcher_app.tray_menu_labels()
        assert set(labels) == set(launcher_app.tray.menu_action_ids())
        assert all(isinstance(v, str) and v for v in labels.values())
