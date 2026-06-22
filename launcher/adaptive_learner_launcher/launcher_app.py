"""Persistent launcher window (LauncherApp) + inline port field.

A single long-lived window (instead of the dialog chain) that shows the
current state and lets the user act. The Tk layer is intentionally thin:
all business logic goes through :mod:`actions`, and the pure helpers below
(``port_editable`` / ``buttons_for_state`` / ``dispatch_action``) carry the
behaviour so they are unit-testable without a display.

Opt-in via ``python -m adaptive_learner_launcher --window`` while the
classic flow remains the default; promote it to default once verified on
a real device.
"""

from __future__ import annotations

import logging
import threading
import tkinter as tk
from pathlib import Path

from adaptive_learner_launcher import actions, config, i18n, manifest, ui

logger = logging.getLogger("adaptive_learner_launcher.launcher_app")

# Short state headings. Hardcoded for the opt-in window (default language
# is German); promote to i18n keys when this becomes the default launcher.
_STATE_LABELS = {
    "no_docker": "Docker ist nicht gestartet",
    "not_installed": "Adaptive Learner ist nicht installiert",
    "running": "Adaptive Learner laeuft",
    "stopped": "Adaptive Learner ist installiert, aber gestoppt",
}

# action_id -> i18n label key, per state. action_id drives dispatch_action.
_BUTTONS: dict[str, list[tuple[str, str]]] = {
    "no_docker": [("recheck", "common.retry")],
    "not_installed": [("install", "install_prompt.install_button"), ("cancel", "common.cancel")],
    "stopped": [("start", "manage.start"), ("uninstall", "manage.uninstall")],
    "running": [("open", "common.open_browser"), ("stop", "manage.stop"), ("uninstall", "manage.uninstall")],
}


def port_editable(state: str) -> bool:
    """The port field is editable only before the app is running."""
    return state in ("not_installed", "stopped")


def buttons_for_state(state: str) -> list[tuple[str, str]]:
    """Return ``[(action_id, i18n_label_key), ...]`` for ``state``."""
    return list(_BUTTONS.get(state, []))


def dispatch_action(action_id: str, *, compose_file: str, project: str, port: int) -> tuple[bool, str] | None:
    """Run the action for ``action_id`` through the actions layer.

    Returns ``(ok, message)`` for actions that report a result, or
    ``None`` for fire-and-forget / navigational ids (open, cancel,
    recheck). Pure (no Tk) so it is unit-testable by mocking ``actions``.
    """
    if action_id == "install":
        return actions.install(compose_file, project, port)
    if action_id == "start":
        return actions.start(compose_file, project)
    if action_id == "stop":
        return actions.stop(project)
    if action_id == "uninstall":
        return actions.uninstall(project)
    if action_id == "open":
        actions.open_browser(port)
        return None
    if action_id in ("recheck", "cancel"):
        return None
    logger.warning("unknown action_id: %s", action_id)
    return None


class LauncherApp:
    """The persistent window. Thin Tk over the helpers above."""

    def __init__(self, *, project: str = actions.DEFAULT_PROJECT) -> None:
        self._project = project
        self._config_path = config.launcher_config_path()
        repo = manifest.install_dir_from_manifest() or config.resolve_repo_path()
        self._compose_file = str(repo / config.COMPOSE_FILENAME)
        self._port = config.read_public_port(repo) if repo else actions.DEFAULT_PORT

        self._root = tk.Tk()
        self._root.title("Adaptive Learner")
        self._root.geometry("440x320")
        ui._set_window_icon(self._root)  # crash-safe (#956)

        self._state_label = tk.Label(self._root, font=("Segoe UI", 12, "bold"))
        self._state_label.pack(pady=(18, 8))

        port_row = tk.Frame(self._root)
        port_row.pack(pady=(0, 8))
        tk.Label(port_row, text="Port:").pack(side="left", padx=(0, 6))
        self._port_var = tk.StringVar(value=str(self._port))
        self._port_entry = tk.Entry(port_row, textvariable=self._port_var, width=8)
        self._port_entry.pack(side="left")
        self._port_indicator = tk.Label(port_row, text="", width=2)
        self._port_indicator.pack(side="left", padx=(6, 0))
        self._port_entry.bind("<KeyRelease>", lambda _e: self._validate_port())

        self._detail = tk.Label(self._root, text="", fg="#555", wraplength=400, justify="left")
        self._detail.pack(pady=(0, 8))

        self._button_row = tk.Frame(self._root)
        self._button_row.pack(pady=(4, 0))

        self._refresh()

    # --- rendering ---

    def _refresh(self) -> None:
        state = actions.get_state(self._project)
        self._state_label.configure(text=_STATE_LABELS.get(state, state))
        editable = port_editable(state)
        self._port_entry.configure(state="normal" if editable else "disabled")
        self._validate_port()
        for child in self._button_row.winfo_children():
            child.destroy()
        for action_id, label_key in buttons_for_state(state):
            tk.Button(
                self._button_row, text=i18n.t(label_key), width=18,
                command=lambda a=action_id: self._on_action(a),
            ).pack(side="left", padx=4)

    def _validate_port(self) -> None:
        raw = self._port_var.get().strip()
        if not raw.isdigit():
            self._port_indicator.configure(text="✗", fg="#c5221f")
            return
        free, _ = actions.check_port(int(raw))
        self._port_indicator.configure(
            text="✓" if free else "✗",
            fg="#188038" if free else "#c5221f",
        )

    # --- actions (threaded) ---

    def _on_action(self, action_id: str) -> None:
        if action_id == "cancel":
            self._root.destroy()
            return
        # Persist an edited port before a lifecycle action uses it.
        raw = self._port_var.get().strip()
        if raw.isdigit():
            ok, _ = actions.set_port(self._config_path, int(raw))
            if ok:
                self._port = int(raw)
        self._set_busy(True)

        def worker() -> None:
            result = dispatch_action(
                action_id, compose_file=self._compose_file,
                project=self._project, port=self._port,
            )
            self._root.after(0, lambda: self._on_result(action_id, result))

        threading.Thread(target=worker, daemon=True).start()

    def _on_result(self, action_id: str, result: tuple[bool, str] | None) -> None:
        self._set_busy(False)
        if result is not None:
            ok, msg = result
            self._detail.configure(text=msg, fg="#188038" if ok else "#c5221f")
        self._refresh()

    def _set_busy(self, busy: bool) -> None:
        for child in self._button_row.winfo_children():
            child.configure(state="disabled" if busy else "normal")
        if busy:
            self._detail.configure(text=i18n.t("status.starting"), fg="#555")

    def run(self) -> None:
        self._root.mainloop()


def run_app(*, project: str = actions.DEFAULT_PROJECT) -> int:
    """Launch the persistent window. Returns 0 on normal close."""
    LauncherApp(project=project).run()
    return 0
