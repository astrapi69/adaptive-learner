"""Tests for the optional system-tray module (#987).

These exercise the import-safe, pystray-free surface: availability flag,
menu spec, icon loading, the zero-arg -> pystray-handler adapter, and the
TrayController no-op path when the ``tray`` extra is absent. The pystray
event loop itself is verified manually on a real device per the quality
rules.
"""

from __future__ import annotations

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
        with patch.object(tray, "HAS_TRAY", True), patch.object(tray, "_load_icon_image", return_value=None):
            assert self._controller().start() is False
