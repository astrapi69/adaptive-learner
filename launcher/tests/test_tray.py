"""Tests for the optional system-tray module (#987).

These exercise the import-safe, pystray-free surface: availability flag,
menu spec, icon loading, the zero-arg -> pystray-handler adapter, and the
TrayController no-op path when the ``tray`` extra is absent. The pystray
event loop itself is verified manually on a real device per the quality
rules.
"""

from __future__ import annotations

import time
import types
from unittest.mock import patch

from adaptive_learner_launcher import tray


class TestAvailability:
    def test_tray_available_reflects_has_tray(self) -> None:
        assert tray.tray_available() is tray.HAS_TRAY

    def test_menu_action_ids_order(self) -> None:
        # Order is the display order: restore, browser, stop, quit.
        assert tray.menu_action_ids() == ["open", "open_browser", "stop", "quit"]

    def test_menu_spec_keys_map_to_i18n(self) -> None:
        for action_id, label_key in tray.MENU_SPEC:
            assert label_key.startswith("tray.")
            assert action_id in label_key or action_id == "open"


class TestMenuHandlerAdapter:
    def test_wraps_zero_arg_callback(self) -> None:
        calls: list[str] = []
        handler = tray._as_menu_handler(lambda: calls.append("hit"))
        # pystray calls handler(icon, item); the adapter ignores both.
        handler("icon", "item")
        handler()
        assert calls == ["hit", "hit"]


class TestLoadIconImage:
    def test_returns_none_without_extra(self) -> None:
        with patch.object(tray, "HAS_TRAY", False):
            assert tray._load_icon_image() is None


class TestTrayControllerNoExtra:
    """Without pystray the controller is a safe no-op."""

    def _controller(self) -> tray.TrayController:
        return tray.TrayController(
            port=8501,
            tooltip="tip",
            labels={a: a for a in tray.menu_action_ids()},
            callbacks={a: (lambda: None) for a in tray.menu_action_ids()},
        )

    def test_start_returns_false(self) -> None:
        with patch.object(tray, "HAS_TRAY", False):
            assert self._controller().start() is False

    def test_stop_is_noop_when_not_started(self) -> None:
        # Must not raise even though start() never ran.
        self._controller().stop()

    def test_start_false_when_icon_image_missing(self) -> None:
        # Extra present but no readable icon -> graceful False, no crash.
        with (
            patch.object(tray, "HAS_TRAY", True),
            patch.object(tray, "_load_icon_image", return_value=None),
        ):
            assert self._controller().start() is False


def _fake_pystray(run_behavior):
    """A stand-in pystray module whose Icon.run runs ``run_behavior``.

    ``run_behavior(icon, setup)`` mimics a backend: it may call ``setup``
    (success), raise (no AppIndicator), or block (tray never appears).
    """

    class FakeIcon:
        def __init__(self, name, image=None, title=None, menu=None) -> None:
            self.name = name
            self.visible = False
            self.stopped = False

        def run(self, setup=None) -> None:
            run_behavior(self, setup)

        def stop(self) -> None:
            self.stopped = True

    return types.SimpleNamespace(
        Icon=FakeIcon,
        Menu=lambda *items: ("menu", items),
        MenuItem=lambda label, handler, default=False: (label, handler, default),
    )


class TestTrayControllerStartThreaded:
    """The icon runs in a daemon thread via ``run(setup=...)``, never
    ``run_detached()`` (unimplemented on Linux GTK/AppIndicator, #1003)."""

    def _controller(self) -> tray.TrayController:
        return tray.TrayController(
            port=8501,
            tooltip="tip",
            labels={a: a for a in tray.menu_action_ids()},
            callbacks={a: (lambda: None) for a in tray.menu_action_ids()},
        )

    def test_no_run_detached_in_source(self) -> None:
        from pathlib import Path

        src = Path(tray.__file__).read_text(encoding="utf-8")
        assert ".run_detached(" not in src, (
            "run_detached() is unsupported on Linux (#1003)"
        )

    def test_start_true_when_icon_becomes_visible(self) -> None:
        fake = _fake_pystray(lambda icon, setup: setup(icon))  # backend shows the icon
        with (
            patch.object(tray, "HAS_TRAY", True),
            patch.object(tray, "pystray", fake),
            patch.object(tray, "_load_icon_image", return_value=object()),
        ):
            ctrl = self._controller()
            assert ctrl.start() is True
            assert ctrl._icon.visible is True

    def test_start_false_when_loop_raises(self) -> None:
        def _raise(icon, setup):
            raise RuntimeError("no appindicator typelib")

        fake = _fake_pystray(_raise)
        with (
            patch.object(tray, "HAS_TRAY", True),
            patch.object(tray, "pystray", fake),
            patch.object(tray, "_load_icon_image", return_value=object()),
        ):
            assert self._controller().start() is False

    def test_start_false_for_unreliable_xorg_backend(self) -> None:
        # The legacy X11 backend fires setup but never docks on GNOME, so it
        # is refused before the window is hidden (#1003).
        fake = _fake_pystray(lambda icon, setup: setup(icon))
        fake.Icon.__module__ = "pystray._xorg"
        with (
            patch.object(tray, "HAS_TRAY", True),
            patch.object(tray, "pystray", fake),
            patch.object(tray, "_load_icon_image", return_value=object()),
        ):
            assert self._controller().start() is False

    def test_start_false_when_tray_never_appears(self) -> None:
        # Backend "runs" but never calls setup -> start times out, no hang.
        fake = _fake_pystray(lambda icon, setup: time.sleep(1.0))
        with (
            patch.object(tray, "HAS_TRAY", True),
            patch.object(tray, "pystray", fake),
            patch.object(tray, "_load_icon_image", return_value=object()),
            patch.object(tray.TrayController, "_READY_TIMEOUT_SECONDS", 0.1),
        ):
            assert self._controller().start() is False
