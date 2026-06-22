"""Optional system-tray support for the persistent launcher window.

``pystray`` + ``Pillow`` are an OPTIONAL dependency (the ``tray`` extra:
``pip install adaptive-learner-launcher[tray]``). When they are NOT
installed the launcher behaves exactly as before - the window's X button
closes it - and nothing here crashes. When they ARE installed AND the app
is running, the window minimizes to the system tray instead, exposing a
right-click menu and click-to-restore.

This module owns ONLY the tray-icon lifecycle. Every menu action routes
back through the callbacks the caller supplies (which in turn go through
:mod:`adaptive_learner_launcher.actions` or the Tk window); no business
logic lives here. It is import-safe without the extra so the rest of the
launcher - and its tests - never depend on ``pystray`` being present.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path

logger = logging.getLogger("adaptive_learner_launcher.tray")

try:
    import pystray
    from PIL import Image

    HAS_TRAY = True
except ImportError:  # pragma: no cover - exercised only without the extra
    pystray = None  # type: ignore[assignment]
    Image = None  # type: ignore[assignment]
    HAS_TRAY = False

# Icon source priority: the canonical frontend brand mark first, then the
# launcher's own bundled PNG. A missing/unreadable icon disables the tray
# (the caller falls back to a plain close), never a crash.
_ICON_CANDIDATES = (
    Path(__file__).parents[2] / "frontend" / "branding" / "adaptive-learner-mark.png",
    Path(__file__).parent / "adaptive-learner.png",
)

# The tray menu, in display order: (action_id, i18n_label_key). action_id
# maps 1:1 to a caller-supplied callback. Pure data so the composition is
# unit-testable without pystray.
MENU_SPEC: tuple[tuple[str, str], ...] = (
    ("open", "tray.open"),
    ("open_browser", "tray.open_browser"),
    ("stop", "tray.stop"),
    ("quit", "tray.quit"),
)


def tray_available() -> bool:
    """True when ``pystray`` + ``Pillow`` are importable (the ``tray`` extra)."""
    return HAS_TRAY


def menu_action_ids() -> list[str]:
    """Return the tray menu action ids in display order. Pure (no pystray)."""
    return [action_id for action_id, _ in MENU_SPEC]


def _load_icon_image():
    """Load the tray icon as a PIL image, or ``None`` when unavailable.

    Best-effort: returns ``None`` (rather than raising) when the extra is
    absent or no icon file can be read, so the caller can fall back to a
    plain window close.
    """
    if not HAS_TRAY:
        return None
    for candidate in _ICON_CANDIDATES:
        if not candidate.is_file():
            continue
        try:
            return Image.open(str(candidate))
        except Exception as exc:  # noqa: BLE001 - icon is best-effort
            logger.debug("could not load tray icon %s: %s", candidate, exc)
    logger.warning("no tray icon image found in %s", [str(c) for c in _ICON_CANDIDATES])
    return None


class TrayController:
    """Owns the ``pystray`` icon lifecycle for the launcher window.

    Construct with the port (tooltip + browser action), the localized menu
    ``labels`` (keyed by action id), and one callback per action id. Each
    callback is invoked on the pystray thread, so a callback that touches
    Tk must marshal onto the Tk thread itself (the window passes
    ``root.after``-wrapped callbacks).

    A no-op when the ``tray`` extra is not installed: :meth:`start` returns
    ``False`` and :meth:`stop` does nothing.

    Example:
        tray = TrayController(
            port=8501,
            tooltip="Adaptive Learner is running on port 8501",
            labels={"open": "Open", "open_browser": "Open in browser",
                    "stop": "Stop", "quit": "Quit"},
            callbacks={"open": restore, "open_browser": open_browser,
                       "stop": stop, "quit": quit},
        )
        if tray.start():
            root.withdraw()
    """

    def __init__(
        self,
        *,
        port: int,
        tooltip: str,
        labels: dict[str, str],
        callbacks: dict[str, Callable[[], None]],
    ) -> None:
        self._port = port
        self._tooltip = tooltip
        self._labels = labels
        self._callbacks = callbacks
        self._icon = None

    def start(self) -> bool:
        """Show the tray icon. Returns ``True`` on success, ``False`` when
        the extra is missing or no icon image is available."""
        if not HAS_TRAY:
            return False
        image = _load_icon_image()
        if image is None:
            return False
        self._icon = pystray.Icon(
            "adaptive-learner",
            image,
            self._tooltip,
            self._build_menu(),
        )
        try:
            self._icon.run_detached()
        except Exception as exc:  # noqa: BLE001 - backend may lack detached run
            logger.warning("could not start tray icon: %s", exc)
            self._icon = None
            return False
        return True

    def stop(self) -> None:
        """Remove the tray icon. Safe to call when not started."""
        if self._icon is None:
            return
        try:
            self._icon.stop()
        except Exception as exc:  # noqa: BLE001 - teardown must never raise
            logger.debug("tray icon stop failed: %s", exc)
        self._icon = None

    def _build_menu(self):
        items = []
        for action_id, _label_key in MENU_SPEC:
            callback = self._callbacks.get(action_id)
            if callback is None:
                continue
            items.append(
                pystray.MenuItem(
                    self._labels.get(action_id, action_id),
                    _as_menu_handler(callback),
                    # Make "open" the default item so a single/double click
                    # on the tray icon restores the window.
                    default=(action_id == "open"),
                )
            )
        return pystray.Menu(*items)


def _as_menu_handler(callback: Callable[[], None]) -> Callable[..., None]:
    """Adapt a zero-arg callback to pystray's ``handler(icon, item)`` shape."""

    def _handler(_icon=None, _item=None) -> None:
        callback()

    return _handler
