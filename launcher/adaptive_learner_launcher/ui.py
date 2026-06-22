"""Tkinter UI helpers. Thin layer over tkinter.messagebox and a tiny status window.

Kept minimal on purpose: Tkinter ships with Python, so the PyInstaller
bundle stays small. UI code is NOT unit-tested; logic lives in the
other modules and UI is a thin render of their return values.
"""

from __future__ import annotations

import datetime
import locale
import logging
import threading
import tkinter as tk
import webbrowser
from tkinter import filedialog, messagebox


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


def error_box(title: str, message: str) -> None:
    _ensure_root()
    messagebox.showerror(title, message)


def info_box(title: str, message: str) -> None:
    _ensure_root()
    messagebox.showinfo(title, message)


def ask_retry_quit(title: str, message: str) -> bool:
    """Show Retry/Quit dialog. True for Retry, False for Quit."""
    _ensure_root()
    return messagebox.askretrycancel(title, message)


def ask_copyable_url(url: str) -> None:
    """Popup a small window showing a URL the user can copy/paste."""
    _ensure_root()
    win = tk.Toplevel()
    win.title("Adaptive Learner URL")
    tk.Label(win, text="Copy this URL and paste into your browser:").pack(padx=16, pady=(16, 4))
    entry = tk.Entry(win, width=40)
    entry.insert(0, url)
    entry.configure(state="readonly")
    entry.pack(padx=16, pady=4)
    tk.Button(win, text="OK", command=win.destroy).pack(padx=16, pady=(4, 16))
    win.grab_set()
    win.wait_window()


def pick_folder(title: str, initial_dir: str | None = None) -> str | None:
    """Show a folder picker. Returns the selected path or None if cancelled."""
    _ensure_root()
    kwargs: dict = {"title": title}
    if initial_dir:
        kwargs["initialdir"] = initial_dir
    else:
        kwargs["mustexist"] = True
    result = filedialog.askdirectory(**kwargs)
    return result or None


def error_dialog(
    title: str,
    message: str,
    *,
    actions: list[tuple[str, str]],
    details: str = "",
    help_url: str | None = None,
    initial_show_details: bool = False,
) -> str:
    """Error dialog with optional collapsible technical details.

    ``message`` is the user-friendly explanation and recommended action
    (kept free of internal file names, ports, raw stderr).

    ``details`` is the technical block revealed by the Show-details
    toggle. Supports multi-line text; includes Save-log and
    Copy-clipboard helpers when non-empty.

    ``actions`` is a list of ``(label, return_value)`` tuples. The first
    entry is the default (Enter-activated) button. The cancel-equivalent
    is always the last entry; Escape / window-X map to its
    ``return_value``.

    ``help_url`` adds a Help button that opens the URL in the default
    browser. Independent of the action buttons.

    ``initial_show_details`` defaults to False so end users see the
    plain-language view first. Set True via the launcher config to
    auto-expand for developers.
    """
    assert actions, "error_dialog requires at least one action"
    _ensure_root()
    dlg = _ErrorDialog(
        title=title,
        message=message,
        actions=actions,
        details=details,
        help_url=help_url,
        initial_show_details=initial_show_details,
    )
    return dlg.show()


class _ErrorDialog:
    """Internal impl of error_dialog. Separate class so the widget
    references can be captured by closures and the test surface is
    narrower (public callers only see ``error_dialog``).
    """

    PAD = 16

    def __init__(
        self,
        *,
        title: str,
        message: str,
        actions: list[tuple[str, str]],
        details: str,
        help_url: str | None,
        initial_show_details: bool,
    ) -> None:
        self._actions = actions
        self._details = details
        self._help_url = help_url
        self._result = actions[-1][1]  # default to cancel-equivalent
        self._details_visible = False

        self._win = tk.Toplevel()
        self._win.title(title)
        self._win.resizable(False, False)

        tk.Label(
            self._win,
            text=message,
            justify="left",
            wraplength=460,
            padx=self.PAD,
            pady=self.PAD,
        ).pack(fill="x")

        self._buttons_frame = tk.Frame(self._win)
        self._buttons_frame.pack(fill="x", padx=self.PAD, pady=(0, self.PAD))
        self._build_action_buttons()

        self._details_frame = tk.Frame(self._win)
        self._details_text: tk.Text | None = None
        if details:
            self._build_details_frame()
        if initial_show_details and details:
            self._toggle_details()

        self._win.bind("<Return>", lambda _e: self._handle_action(self._actions[0][1]))
        self._win.bind("<Escape>", lambda _e: self._handle_action(self._actions[-1][1]))
        self._win.protocol("WM_DELETE_WINDOW", lambda: self._handle_action(self._actions[-1][1]))
        _center_over_root(self._win)

    # --- Construction ---

    def _build_action_buttons(self) -> None:
        # Primary and secondary action buttons. Leftmost is the default.
        for index, (label, value) in enumerate(self._actions):
            width = 14 if index == 0 else 10
            tk.Button(
                self._buttons_frame,
                text=label,
                width=width,
                command=lambda v=value: self._handle_action(v),
            ).pack(side="left", padx=(0, 6))

        # Spacer pushes the auxiliary buttons to the right.
        tk.Frame(self._buttons_frame).pack(side="left", expand=True, fill="x")

        if self._help_url:
            tk.Button(
                self._buttons_frame,
                text=_t("help"),
                width=8,
                command=self._open_help,
            ).pack(side="left", padx=(0, 6))
        if self._details:
            self._toggle_button = tk.Button(
                self._buttons_frame,
                text=_t("show_details"),
                width=16,
                command=self._toggle_details,
            )
            self._toggle_button.pack(side="left")

    def _build_details_frame(self) -> None:
        tk.Label(
            self._details_frame,
            text=_t("technical_details"),
            anchor="w",
            font=("Segoe UI", 9, "bold"),
            padx=self.PAD,
        ).pack(fill="x", pady=(0, 4))

        text_widget = tk.Text(
            self._details_frame,
            height=10,
            width=70,
            wrap="none",
            font=("Consolas", 9),
            borderwidth=1,
            relief="solid",
        )
        text_widget.insert("1.0", self._details)
        text_widget.configure(state="disabled")
        text_widget.pack(fill="both", expand=True, padx=self.PAD)

        tools = tk.Frame(self._details_frame)
        tools.pack(fill="x", padx=self.PAD, pady=(6, self.PAD))
        tk.Button(tools, text=_t("save_log"), command=self._save_log).pack(side="left", padx=(0, 6))
        tk.Button(tools, text=_t("copy_clipboard"), command=self._copy_clipboard).pack(side="left")

        self._details_text = text_widget

    # --- Events ---

    def _toggle_details(self) -> None:
        if self._details_visible:
            self._details_frame.pack_forget()
            self._toggle_button.configure(text=_t("show_details"))
        else:
            self._details_frame.pack(fill="both", expand=True)
            self._toggle_button.configure(text=_t("hide_details"))
        self._details_visible = not self._details_visible
        self._win.update_idletasks()
        _center_over_root(self._win)

    def _open_help(self) -> None:
        if not self._help_url:
            return
        try:
            webbrowser.open(self._help_url)
        except OSError:
            pass

    def _save_log(self) -> None:
        ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        default_name = _t("save_default_filename").format(ts=ts)
        path = filedialog.asksaveasfilename(
            title=_t("save_log"),
            defaultextension=".log",
            initialfile=default_name,
            filetypes=[("Log files", "*.log"), ("All files", "*.*")],
        )
        if not path:
            return
        try:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(self._details)
        except OSError:
            messagebox.showerror(_t("save_log"), _t("save_log"))

    def _copy_clipboard(self) -> None:
        root = _ensure_root()
        try:
            root.clipboard_clear()
            root.clipboard_append(self._details)
            root.update()
        except tk.TclError:
            return
        # Transient confirmation via the window title so we do not spawn a
        # second modal for a one-click action.
        original = self._win.title()
        self._win.title(f"{original}  —  {_t('copied')}")
        self._win.after(1500, lambda: self._win.title(original))

    def _handle_action(self, value: str) -> None:
        self._result = value
        self._win.destroy()

    # --- Public ---

    def show(self) -> str:
        self._win.grab_set()
        self._win.wait_window()
        return self._result


def two_button_dialog(
    title: str,
    message: str,
    primary_label: str,
    secondary_label: str,
) -> str:
    """Show a message with exactly two labeled buttons. Returns
    ``primary`` or ``secondary`` depending on which button the user
    clicks. Closing the window via the X returns ``secondary`` (treated
    as the dismissive choice).

    Primary is Enter-default, secondary is Escape. Used for simple
    "do this or close" flows like the first-run welcome dialog where
    a folder picker would be a dead end.
    """
    _ensure_root()
    win = tk.Toplevel()
    win.title(title)
    win.resizable(False, False)

    result = {"choice": "secondary"}

    tk.Label(
        win, text=message, justify="left", wraplength=440, padx=20, pady=16,
    ).pack()

    buttons = tk.Frame(win)
    buttons.pack(padx=20, pady=(0, 16))

    def _click(choice: str) -> None:
        result["choice"] = choice
        win.destroy()

    primary = tk.Button(buttons, text=primary_label, width=22, command=lambda: _click("primary"))
    primary.pack(side="left", padx=(0, 8))
    tk.Button(buttons, text=secondary_label, width=12, command=lambda: _click("secondary")).pack(side="left")

    primary.focus_set()
    win.bind("<Return>", lambda _e: _click("primary"))
    win.bind("<Escape>", lambda _e: _click("secondary"))
    win.protocol("WM_DELETE_WINDOW", lambda: _click("secondary"))

    _center_over_root(win)
    win.grab_set()
    win.wait_window()
    return result["choice"]


def three_button_dialog(
    title: str,
    message: str,
    primary_label: str,
    secondary_label: str,
    cancel_label: str = "Cancel",
) -> str:
    """Show a message with three labeled buttons. Returns ``primary``,
    ``secondary``, or ``cancel`` depending on which button the user clicks.

    Closing the window via the X returns ``cancel``. The primary button
    is the default (Enter), the cancel button maps to Escape.
    """
    _ensure_root()
    win = tk.Toplevel()
    win.title(title)
    win.resizable(False, False)

    result = {"choice": "cancel"}

    label = tk.Label(win, text=message, justify="left", wraplength=420, padx=20, pady=16)
    label.pack()

    buttons = tk.Frame(win)
    buttons.pack(padx=20, pady=(0, 16))

    def _click(choice: str) -> None:
        result["choice"] = choice
        win.destroy()

    primary = tk.Button(buttons, text=primary_label, width=20, command=lambda: _click("primary"))
    primary.pack(side="left", padx=(0, 8))
    tk.Button(buttons, text=secondary_label, width=20, command=lambda: _click("secondary")).pack(side="left", padx=(0, 8))
    tk.Button(buttons, text=cancel_label, width=10, command=lambda: _click("cancel")).pack(side="left")

    primary.focus_set()
    win.bind("<Return>", lambda _e: _click("primary"))
    win.bind("<Escape>", lambda _e: _click("cancel"))
    win.protocol("WM_DELETE_WINDOW", lambda: _click("cancel"))

    _center_over_root(win)
    win.grab_set()
    win.wait_window()
    return result["choice"]


def choice_dialog(
    title: str,
    message: str,
    buttons: list[tuple[str, str]],
    *,
    links: list[tuple[str, str]] | None = None,
) -> str | None:
    """Show a message with N labeled buttons; return the chosen value.

    ``buttons`` is a list of ``(label, value)`` tuples rendered left to
    right. The first button is the Enter-default. Closing the window via
    the X or pressing Escape returns ``None`` (an explicit "do nothing"
    that is distinct from any button value) so a destructive action can
    never be triggered by closing the window.

    ``links`` is an optional list of ``(label, url)`` tuples rendered as
    a separate row of buttons that open ``url`` in the browser WITHOUT
    closing the dialog. This lets the user read an external page (release
    notes, install guide) and return to choose an option. Only the
    ``buttons`` choices and the window X/Escape dismiss the dialog
    (#956).

    Used for the installed-app management menu (Open / Stop / Uninstall)
    where the cancel-equivalent must be a no-op, not the last button.
    """
    assert buttons, "choice_dialog requires at least one button"
    _ensure_root()
    win = tk.Toplevel()
    win.title(title)
    win.resizable(False, False)

    result: dict = {"choice": None}

    tk.Label(win, text=message, justify="left", wraplength=420, padx=20, pady=16).pack()

    def _open_link(url: str) -> None:
        # Open the browser WITHOUT dismissing the dialog.
        logger.debug("dialog link open (dialog stays open): %s", url)
        try:
            webbrowser.open(url)
        except OSError as exc:
            logger.warning("opening %s failed: %s", url, exc)

    if links:
        link_row = tk.Frame(win)
        link_row.pack(padx=20, pady=(0, 8))
        for index, (label, url) in enumerate(links):
            tk.Button(
                link_row, text=label, width=24,
                command=lambda u=url: _open_link(u),
            ).pack(side="left", padx=(0, 8) if index < len(links) - 1 else 0)

    button_row = tk.Frame(win)
    button_row.pack(padx=20, pady=(0, 16))

    def _click(value: str | None) -> None:
        result["choice"] = value
        win.destroy()

    first_button: tk.Button | None = None
    for index, (label, value) in enumerate(buttons):
        btn = tk.Button(button_row, text=label, width=16, command=lambda v=value: _click(v))
        btn.pack(side="left", padx=(0, 8) if index < len(buttons) - 1 else 0)
        if first_button is None:
            first_button = btn

    if first_button is not None:
        first_button.focus_set()
        win.bind("<Return>", lambda _e: _click(buttons[0][1]))
    win.bind("<Escape>", lambda _e: _click(None))
    win.protocol("WM_DELETE_WINDOW", lambda: _click(None))

    _center_over_root(win)
    win.grab_set()
    win.wait_window()
    return result["choice"]


def welcome_dialog(*, guide_url: str, security_url: str | None = None) -> None:
    """First-ever-launch welcome screen.

    Blocks until the user clicks "Continue". Shows what AdaptiveLearner
    needs (Docker Desktop, ~800 MB), what the first run looks like
    (~2 GB / 5-10 min), and a brief Docker trust statement so non-
    technical users understand the install is from a well-known
    vendor.

    The dialog is non-skippable on purpose: the prompt that asked for
    it called out that users without prior context need this
    information up front. Closing the window via the X equals
    Continue (no harm clicking through; the welcomed flag still
    flips and they will encounter the Docker-missing dialog next if
    Docker is absent).

    ``guide_url`` is the URL of the AdaptiveLearner Docker installation
    guide. ``security_url`` is the optional anchor link to the
    "Is Docker safe?" section of the same guide; when provided, a
    second link below the trust sentence opens that anchor.
    """
    from adaptive_learner_launcher import i18n

    _ensure_root()
    win = tk.Toplevel()
    win.title(i18n.t("welcome.title"))
    win.resizable(False, False)

    body = tk.Frame(win, padx=24, pady=20)
    body.pack(fill="both", expand=True)

    tk.Label(
        body,
        text=i18n.t("welcome.heading"),
        font=("Segoe UI", 14, "bold"),
        anchor="w",
        justify="left",
    ).pack(fill="x", pady=(0, 12))

    paragraph = (
        f"{i18n.t('welcome.docker_required')}\n\n"
        f"{i18n.t('welcome.docker_size')}\n\n"
        f"{i18n.t('welcome.first_run_size')}\n\n"
        f"{i18n.t('welcome.trust_anchor')}"
    )
    tk.Label(
        body,
        text=paragraph,
        wraplength=480,
        justify="left",
        anchor="w",
    ).pack(fill="x", pady=(0, 12))

    if security_url:
        trust_link = tk.Label(
            body,
            text=i18n.t("welcome.trust_link"),
            fg="#1a73e8",
            cursor="hand2",
            anchor="w",
        )
        trust_link.pack(fill="x", pady=(0, 4))
        trust_link.bind("<Button-1>", lambda _e: webbrowser.open(security_url))

    guide_link = tk.Label(
        body,
        text=i18n.t("welcome.guide_link"),
        fg="#1a73e8",
        cursor="hand2",
        anchor="w",
    )
    guide_link.pack(fill="x", pady=(0, 16))
    guide_link.bind("<Button-1>", lambda _e: webbrowser.open(guide_url))

    button = tk.Button(
        body,
        text=i18n.t("welcome.continue_button"),
        width=22,
        command=win.destroy,
    )
    button.pack(pady=(4, 0))
    button.focus_set()
    win.bind("<Return>", lambda _e: win.destroy())
    win.protocol("WM_DELETE_WINDOW", win.destroy)

    _center_over_root(win)
    win.grab_set()
    win.wait_window()


def settings_dialog(current: dict) -> dict | None:
    """Show a settings dialog. Returns the new settings dict on Save,
    or None if the user cancelled.

    ``current`` is the starting state (typically the result of
    ``settings.read_settings()``). Only the keys rendered in the UI
    are updated; any other keys in ``current`` pass through unchanged
    so forward-compatibility with future settings is automatic.
    """
    from adaptive_learner_launcher import i18n

    _ensure_root()
    win = tk.Toplevel()
    win.title(i18n.t("settings.title"))
    win.resizable(False, False)

    result: dict = {"saved": None}
    initial_language = current.get("language")

    # Body
    body = tk.Frame(win, padx=20, pady=16)
    body.pack(fill="both", expand=True)

    auto_update_var = tk.BooleanVar(value=bool(current.get("auto_update_check", True)))
    tk.Checkbutton(
        body,
        text="Check for updates automatically",
        variable=auto_update_var,
        anchor="w",
    ).pack(fill="x", pady=(0, 8))

    tk.Label(
        body,
        text="When enabled, the launcher checks GitHub for newer versions\non every start.",
        justify="left",
        fg="#555",
        font=("Segoe UI", 9),
    ).pack(fill="x", pady=(0, 12))

    # Language selector. Maps a friendly label to the ISO code; the
    # active code keeps the JSON-catalog filename so the wiring stays
    # trivial.
    tk.Label(body, text=i18n.t("settings.language_label"), anchor="w").pack(
        fill="x", pady=(0, 4)
    )
    language_codes = i18n.available_languages() or ["en"]
    language_label_keys = {
        "de": "settings.language_de",
        "el": "settings.language_el",
        "en": "settings.language_en",
        "es": "settings.language_es",
        "fr": "settings.language_fr",
        "ja": "settings.language_ja",
        "pt": "settings.language_pt",
        "tr": "settings.language_tr",
    }
    code_to_label = {code: i18n.t(language_label_keys.get(code, code)) for code in language_codes}
    label_to_code = {label: code for code, label in code_to_label.items()}
    language_var = tk.StringVar(
        value=code_to_label.get(initial_language, code_to_label[language_codes[0]])
        if initial_language
        else code_to_label[language_codes[0]]
    )
    tk.OptionMenu(body, language_var, *code_to_label.values()).pack(fill="x", pady=(0, 4))
    tk.Label(
        body,
        text=i18n.t("settings.language_restart_notice"),
        justify="left",
        fg="#555",
        font=("Segoe UI", 9),
    ).pack(fill="x", pady=(0, 8))

    # Footer
    footer = tk.Frame(win, padx=20, pady=(0, 16))
    footer.pack(fill="x")

    def _save() -> None:
        new_settings = dict(current)
        new_settings["auto_update_check"] = bool(auto_update_var.get())
        new_settings["language"] = label_to_code.get(language_var.get(), initial_language)
        result["saved"] = new_settings
        win.destroy()

    def _cancel() -> None:
        result["saved"] = None
        win.destroy()

    save_btn = tk.Button(footer, text="Save", width=12, command=_save)
    save_btn.pack(side="right", padx=(8, 0))
    tk.Button(footer, text="Cancel", width=12, command=_cancel).pack(side="right")

    save_btn.focus_set()
    win.bind("<Return>", lambda _e: _save())
    win.bind("<Escape>", lambda _e: _cancel())
    win.protocol("WM_DELETE_WINDOW", _cancel)

    _center_over_root(win)
    win.grab_set()
    win.wait_window()
    return result["saved"]


def _center_over_root(win: tk.Toplevel) -> None:
    win.update_idletasks()
    try:
        root = _root_singleton
        if root is None:
            return
        x = root.winfo_rootx() + (root.winfo_width() - win.winfo_width()) // 2
        y = root.winfo_rooty() + (root.winfo_height() - win.winfo_height()) // 2
        win.geometry(f"+{max(x, 0)}+{max(y, 0)}")
    except tk.TclError:
        pass


class StatusWindow:
    """A small window that shows progress as a step checklist + Stop button.

    The step list gives the user concrete feedback ("Download...",
    "Start container...", "Ready") so a slow first-run build never looks
    like a crash. Each step renders a status glyph: pending (·), active
    (animated spinner), done (check) or failed (cross).

    Usage:
        win = StatusWindow()
        win.set_steps(["Check Docker", "Start container", "Ready"])
        win.start_step(0); win.complete_step(0)
        ...
        win.set_running(port, on_stop=callback)
        win.run_mainloop()  # blocks until stop
    """

    _SPINNER_FRAMES = ("|", "/", "-", "\\")
    _GLYPH_PENDING = "·"  # middle dot
    _GLYPH_DONE = "✓"  # check mark
    _GLYPH_FAILED = "✗"  # ballot x

    def __init__(self, on_close: callable | None = None, *, title: str | None = None) -> None:
        self._root = _ensure_root()
        self._root.title("Adaptive Learner")
        self._root.geometry("420x340")
        self._root.protocol("WM_DELETE_WINDOW", self._handle_close)
        # Route Tk callback exceptions through the logger so a crash in a
        # scheduled callback lands in launcher-debug.log (with --debug),
        # not only on stderr. This is how the #948 destroy() crash was
        # diagnosed; capturing it makes the next one self-reporting.
        self._root.report_callback_exception = self._log_tk_exception

        self._label = tk.Label(
            self._root,
            text=title or "Starting AdaptiveLearner...",
            font=("Segoe UI", 12, "bold"),
        )
        self._label.pack(pady=(20, 8))

        # Step checklist. Each entry is (glyph_label, text_label).
        self._steps_frame = tk.Frame(self._root)
        self._steps_frame.pack(fill="x", padx=28, pady=(0, 8))
        self._step_rows: list[tuple[tk.Label, tk.Label]] = []
        self._active_index: int | None = None
        self._spinner_frame = 0

        self._detail = tk.Label(self._root, text="", font=("Segoe UI", 9), fg="#555", wraplength=380, justify="left")
        self._detail.pack(pady=(0, 8))

        self._button = tk.Button(self._root, text="", state="disabled", width=22)
        self._button.pack(pady=(0, 8))

        # Secondary action button (e.g. Settings). Hidden until set_running
        # populates it so the starting-state UI stays minimal.
        self._secondary = tk.Button(self._root, text="", width=22)
        self._secondary.pack(pady=(0, 16))
        self._secondary.pack_forget()

        self._on_close_cb = on_close
        self._stop_cb: callable | None = None
        self._spinner_running = False
        self._spinner_after_id: str | None = None

    # --- Step checklist API ---

    def set_title(self, title: str) -> None:
        self._label.configure(text=title)
        self._root.update_idletasks()

    def set_steps(self, labels: list[str]) -> None:
        """Render a fresh checklist with every step in the pending state."""
        for glyph, text in self._step_rows:
            glyph.destroy()
            text.destroy()
        self._step_rows = []
        self._active_index = None
        for label in labels:
            row = tk.Frame(self._steps_frame)
            row.pack(fill="x", pady=2)
            glyph = tk.Label(row, text=self._GLYPH_PENDING, font=("Consolas", 11), width=2, fg="#999")
            glyph.pack(side="left")
            text_label = tk.Label(row, text=label, font=("Segoe UI", 10), anchor="w", fg="#777")
            text_label.pack(side="left", fill="x")
            self._step_rows.append((glyph, text_label))
        self._root.update_idletasks()

    def start_step(self, index: int, detail: str = "") -> None:
        """Mark step ``index`` active (spinner) and update the detail line."""
        logger.debug("step %d start: %s", index, detail)
        self._active_index = index
        self._set_glyph(index, self._SPINNER_FRAMES[0], "#1a73e8")
        self._highlight_text(index, "#222")
        if detail:
            self._detail.configure(text=detail)
        self._ensure_spinner()
        self._root.update_idletasks()

    def complete_step(self, index: int) -> None:
        logger.debug("step %d complete", index)
        self._set_glyph(index, self._GLYPH_DONE, "#188038")
        self._highlight_text(index, "#444")
        if self._active_index == index:
            self._active_index = None
        self._root.update_idletasks()

    def fail_step(self, index: int) -> None:
        logger.debug("step %d FAILED", index)
        self._set_glyph(index, self._GLYPH_FAILED, "#c5221f")
        self._highlight_text(index, "#c5221f")
        if self._active_index == index:
            self._active_index = None
        self._root.update_idletasks()

    def set_error(self, message: str) -> None:
        """Surface an error under the checklist without closing the window."""
        self._detail.configure(text=message, fg="#c5221f")
        self._root.update_idletasks()

    def _set_glyph(self, index: int, glyph: str, color: str) -> None:
        if 0 <= index < len(self._step_rows):
            self._step_rows[index][0].configure(text=glyph, fg=color)

    def _highlight_text(self, index: int, color: str) -> None:
        if 0 <= index < len(self._step_rows):
            self._step_rows[index][1].configure(fg=color)

    def _ensure_spinner(self) -> None:
        if self._spinner_running:
            return
        self._spinner_running = True
        self._tick_spinner()

    def _tick_spinner(self) -> None:
        if self._active_index is not None:
            self._spinner_frame = (self._spinner_frame + 1) % len(self._SPINNER_FRAMES)
            self._set_glyph(self._active_index, self._SPINNER_FRAMES[self._spinner_frame], "#1a73e8")
        try:
            self._spinner_after_id = self._root.after(120, self._tick_spinner)
        except tk.TclError:
            self._spinner_running = False
            self._spinner_after_id = None

    # --- Legacy single-message API (kept for callers not using steps) ---

    def set_starting(self, detail: str = "") -> None:
        self._label.configure(text="Starting AdaptiveLearner...")
        self._detail.configure(text=detail, fg="#555")
        self._button.configure(text="", state="disabled")
        self._root.update_idletasks()

    def set_running(self, port: int, on_stop: callable, on_settings: callable | None = None) -> None:
        self._active_index = None
        self._label.configure(text=f"AdaptiveLearner is running on localhost:{port}")
        self._detail.configure(text="Browser opened. Close this window or click Stop to shut down.", fg="#555")
        self._stop_cb = on_stop
        self._button.configure(text="Stop AdaptiveLearner", state="normal", command=self._handle_stop)
        if on_settings is not None:
            self._secondary.configure(text="Settings", command=on_settings)
            self._secondary.pack(pady=(0, 16))
        self._root.update_idletasks()

    def set_stopping(self) -> None:
        self._active_index = None
        self._label.configure(text="Stopping AdaptiveLearner...")
        self._detail.configure(text="Waiting for docker compose down to finish.", fg="#555")
        self._button.configure(text="", state="disabled")
        self._root.update_idletasks()

    def close(self) -> None:
        logger.debug("StatusWindow.close")
        # Cancel the pending spinner tick first: otherwise the queued
        # after-callback fires after destroy() and Tk raises
        # 'invalid command name ..._tick_spinner' (#956).
        self._spinner_running = False
        if self._spinner_after_id is not None:
            try:
                self._root.after_cancel(self._spinner_after_id)
            except tk.TclError:
                pass
            self._spinner_after_id = None
        try:
            self._root.destroy()
        except tk.TclError:
            pass

    def _log_tk_exception(self, exc_type, exc_value, exc_tb) -> None:
        """Log an exception raised inside a Tk callback.

        Installed as ``self._root.report_callback_exception`` so a crash
        in a scheduled callback is captured by the logger instead of only
        printed to stderr (where it is lost outside ``--debug``).
        """
        logger.error("Tk callback error", exc_info=(exc_type, exc_value, exc_tb))

    def run_mainloop(self) -> None:
        self._root.mainloop()

    def after(self, delay_ms: int, callback: callable) -> None:
        self._root.after(delay_ms, callback)

    def run_in_background(self, target: callable, *args: object) -> threading.Thread:
        """Run ``target`` in a daemon thread so the Tk event loop stays responsive."""
        thread = threading.Thread(target=target, args=args, daemon=True)
        thread.start()
        return thread

    def _handle_stop(self) -> None:
        if self._stop_cb:
            self._stop_cb()

    def _handle_close(self) -> None:
        if self._on_close_cb:
            self._on_close_cb()
        else:
            self._root.destroy()


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
