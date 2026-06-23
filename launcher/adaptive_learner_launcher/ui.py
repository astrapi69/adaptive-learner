"""Tkinter UI helpers (#1045): the OS-locale detector + the window-icon /
Tk-root helpers the persistent window uses.

The old dialog functions + StatusWindow (the dialog chain) were removed with
__main__._run_launcher - the persistent window (launcher_app) is now the sole
GUI surface.

Kept minimal on purpose: Tkinter ships with Python, so the PyInstaller
bundle stays small. UI code is NOT unit-tested; logic lives in the
other modules and UI is a thin render of their return values.
"""

from __future__ import annotations

import locale
import logging
import tkinter as tk


logger = logging.getLogger("adaptive_learner_launcher.ui")


_OS_LOCALE_PREFIXES: tuple[tuple[str, str], ...] = (
    ("de", "de"),
    ("el", "el"),
    ("es", "es"),
    ("fr", "fr"),
    ("pt", "pt"),
    ("tr", "tr"),
    ("ja", "ja"),
)


def _current_lang() -> str:
    """Return the launcher language matching the OS locale, else ``"en"``.

    Single source of truth for OS-locale detection across the
    launcher; ``i18n._resolve_language`` calls this. Matches the
    locale code by prefix (``de_DE``, ``de_AT``, ``de_CH`` all
    resolve to ``de``; ``pt_BR`` and ``pt_PT`` both resolve to
    ``pt``; etc.).
    """
    try:
        code, _ = locale.getlocale()
    except (TypeError, ValueError):
        code = None
    if code is None:
        try:
            code = locale.getdefaultlocale()[0]
        except (ValueError, IndexError, TypeError):
            code = None
    if not code:
        return "en"
    code_lc = code.lower()
    for prefix, lang in _OS_LOCALE_PREFIXES:
        if code_lc.startswith(prefix):
            return lang
    return "en"


def _t(key: str) -> str:
    """Backward-compat wrapper that delegates to the JSON-backed i18n.

    Pre-existing callers (``_t("show_details")`` etc.) continue to
    work; new code should call :func:`adaptive_learner_launcher.i18n.t`
    directly so it can interpolate kwargs.
    """
    from adaptive_learner_launcher import i18n

    return i18n.t(key)


_root_singleton: tk.Tk | None = None


def _ensure_root() -> tk.Tk:
    """Lazily create the hidden root Tk instance used by all dialogs."""
    global _root_singleton
    if _root_singleton is None or not _is_root_alive(_root_singleton):
        _root_singleton = tk.Tk()
        _root_singleton.withdraw()
        _set_window_icon(_root_singleton)
    return _root_singleton


def _set_window_icon(root: tk.Tk) -> None:
    """Set the Adaptive Learner window/taskbar icon. Never raises.

    Tries the launcher's bundled PNG first, then the frontend branding
    mark. A missing or unreadable icon falls back to the Tk default
    (icon problems must never crash the launcher).
    """
    from pathlib import Path as _Path

    candidates = [
        _Path(__file__).parent / "adaptive-learner.png",
        _Path(__file__).parents[2] / "frontend" / "branding" / "adaptive-learner-mark.png",
    ]
    for icon_path in candidates:
        if not icon_path.exists():
            continue
        try:
            image = tk.PhotoImage(file=str(icon_path))
            root.iconphoto(True, image)
            # Keep a reference so the image is not garbage-collected.
            root._al_icon = image  # type: ignore[attr-defined]
            return
        except Exception as exc:  # noqa: BLE001 - icon is best-effort
            logger.debug("could not set window icon from %s: %s", icon_path, exc)


def _is_root_alive(root: tk.Tk) -> bool:
    try:
        root.winfo_exists()
    except tk.TclError:
        return False
    return True
