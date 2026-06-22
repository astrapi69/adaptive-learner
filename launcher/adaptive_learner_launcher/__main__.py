"""Launcher entry point. Orchestrates docker check, repo resolve, compose up,
health wait, browser open, user-controlled stop, compose down.

The flow is intentionally linear: each step has a concrete error dialog
on failure so the user always knows what to do next. Heavy work runs on
a background thread so the Tk event loop stays responsive.

User-facing text in this file is intentionally free of internal file
names, config keys, and raw subprocess output. When a user sees a
dialog they should see plain-language guidance, not developer traces.
Raw details go to launcher.log under %APPDATA%\\AdaptiveLearner so
troubleshooting is possible without leaking complexity into the UI.
"""

from __future__ import annotations

import logging
import shutil
import sys
import webbrowser
from pathlib import Path

from adaptive_learner_launcher import __version__, config, docker, health, i18n, installer, lockfile, manifest, ports, settings, ui, update_check


logger = logging.getLogger("adaptive_learner_launcher")

INSTALL_GUIDE_URL = "https://github.com/astrapi69/adaptive-learner/blob/main/docs/help/en/install/docker-desktop.md"
# Stable "latest release" page (redirects to the newest tag). Used for the
# stale-launcher + update-available dialogs so the link is always current
# and never points at an outdated/missing tag (#952).
RELEASE_PAGE_URL = "https://github.com/astrapi69/adaptive-learner/releases/latest"
DOCKER_INSTALL_URL = "https://docs.docker.com/desktop/install/windows-install/"
DOCKER_GUIDE_URL_EN = "https://github.com/astrapi69/adaptive-learner/blob/main/docs/help/en/install/docker-desktop.md"
DOCKER_GUIDE_URL_DE = "https://github.com/astrapi69/adaptive-learner/blob/main/docs/help/de/install/docker-desktop.md"
DOCKER_SECURITY_ANCHOR_EN = DOCKER_GUIDE_URL_EN + "#is-docker-safe-to-install"
DOCKER_SECURITY_ANCHOR_DE = DOCKER_GUIDE_URL_DE + "#ist-docker-sicher-zu-installieren"


def _docker_guide_url() -> str:
    return DOCKER_GUIDE_URL_DE if i18n.active_language() == "de" else DOCKER_GUIDE_URL_EN


def _docker_security_url() -> str:
    return DOCKER_SECURITY_ANCHOR_DE if i18n.active_language() == "de" else DOCKER_SECURITY_ANCHOR_EN


def _parse_cli_port(argv: list[str] | None = None) -> int | None:
    """Parse an optional ``--port N`` from the command line.

    Returns the port when given and in range, else ``None``. Unknown
    arguments are ignored so the launcher never aborts on a stray flag
    passed by a desktop shortcut.
    """
    import argparse

    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--port", type=int, default=None)
    try:
        known, _ = parser.parse_known_args(argv)
    except SystemExit:
        return None
    if known.port is not None and 1 <= known.port <= 65535:
        return known.port
    if known.port is not None:
        logger.warning("Ignoring out-of-range --port %s", known.port)
    return None


def _parse_cli_debug(argv: list[str] | None = None) -> bool:
    """Return True when ``--debug`` is present on the command line.

    Unknown arguments are ignored so a stray flag passed by a desktop
    shortcut never aborts the launcher (same policy as ``--port``).
    """
    import argparse

    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--debug", action="store_true")
    try:
        known, _ = parser.parse_known_args(argv)
    except SystemExit:
        return False
    return bool(known.debug)


def _maybe_show_help(argv: list[str] | None = None) -> bool:
    """Print usage when ``-h`` / ``--help`` was requested.

    Returns True when help was shown (the caller then exits). Kept
    separate from the lenient ``parse_known_args`` parsers above so the
    launcher only ever exits on an explicit help request, never on a
    stray flag from a desktop shortcut.
    """
    import argparse

    args = sys.argv[1:] if argv is None else argv
    if not ({"-h", "--help"} & set(args)):
        return False
    parser = argparse.ArgumentParser(
        prog="adaptive_learner_launcher",
        description="Adaptive Learner desktop launcher (Docker-based).",
    )
    parser.add_argument(
        "--port", type=int, metavar="N",
        help="Host port for the app (1-65535).",
    )
    parser.add_argument(
        "--debug", action="store_true",
        help="Verbose logging to stdout and launcher-debug.log.",
    )
    parser.print_help()
    return True


def main() -> int:
    if _maybe_show_help(sys.argv[1:]):
        return 0

    debug = _parse_cli_debug(sys.argv[1:])
    _setup_logging(debug=debug)
    logger.info("AdaptiveLearner launcher v%s starting", __version__)
    if debug:
        logger.debug("Debug mode enabled (verbose logging to launcher-debug.log)")

    cli_port = _parse_cli_port(sys.argv[1:])
    if cli_port is not None:
        logger.info("Host port overridden via --port %d", cli_port)

    # i18n must be live before the welcome dialog or any other UI
    # string is rendered. Reads settings.language; falls back to OS
    # locale detection via ui._current_lang() inside i18n itself.
    try:
        i18n.init(settings.get("language"))
    except Exception as exc:
        logger.warning("i18n init failed, continuing in English: %s", exc)

    lock_path = config.lockfile_path()
    try:
        if lockfile.another_instance_alive(lock_path):
            _handle_already_running()
            return 0
    except Exception as exc:
        # Fail open: if the lockfile check crashes for any reason
        # (stdout=None on Windows locale edge case, file encoding,
        # unexpected OS state), assume no other instance and proceed.
        # A false negative (two launchers running) is recoverable;
        # a crash that blocks every single launch is not.
        logger.warning("lockfile check failed, proceeding anyway: %s", exc)
    try:
        lockfile.write_lock(lock_path)
    except Exception as exc:
        logger.warning("could not write lockfile: %s", exc)
    try:
        return _run_launcher(cli_port=cli_port)
    finally:
        lockfile.clear_lock(lock_path)


def _run_launcher(*, cli_port: int | None = None) -> int:
    show_details = config.get_show_details_default()

    # 0. Retry pending cleanup from a previously interrupted uninstall.
    _retry_pending_cleanup()

    # 1. Docker MUST be installed and running before anything else. The
    # user should hit the Docker requirement as the very first thing
    # (#942 Bug 1), not after a welcome or install step that would be
    # wasted if Docker is unavailable.
    if not _ensure_docker_ready(show_details):
        return 1

    # 2. First-ever-launch welcome. Tells the user what the first run
    # looks like (~2 GB / 5-10 min) before the big build kicks off.
    # Shown only after Docker is confirmed ready.
    if not bool(settings.get("welcomed")):
        ui.welcome_dialog(
            guide_url=_docker_guide_url(),
            security_url=_docker_security_url(),
        )
        settings.update("welcomed", True)

    # 3. Locate repo via manifest or legacy launcher.json.
    #    Priority: manifest (written by installer) > launcher.json (legacy).
    #    Three cases:
    #    a) manifest exists + install_dir valid -> proceed
    #    b) manifest exists + install_dir missing -> treat as not installed
    #    c) no manifest -> check legacy launcher.json, else show install UI
    mdata = manifest.read_manifest()
    if mdata and mdata.get("install_dir"):
        repo = Path(mdata["install_dir"])
        if not config.is_valid_repo(repo):
            logger.warning("Manifest points at %s but it is not a valid repo", repo)
            mdata = None  # fall through to install UI

    if mdata is None:
        # Try legacy launcher.json
        repo = config.resolve_repo_path()
        if config.is_valid_repo(repo):
            # Migrate: write manifest so future starts skip legacy path
            try:
                manifest.write_manifest(repo, installer.ADAPTIVE_LEARNER_TARGET_VERSION)
            except Exception as exc:
                logger.warning("Could not write manifest during migration: %s", exc)
            mdata = manifest.read_manifest()
        else:
            had_previous_install = config.launcher_config_path().is_file()
            if had_previous_install:
                repo = _installation_moved_picker()
            else:
                repo = _install_or_welcome()
            if repo is None:
                return 0
            mdata = manifest.read_manifest()

    # 4. Ensure configuration file exists (generated on first run).
    ok, detail = _ensure_env_file(repo)
    if not ok:
        logger.error("env-file preparation failed: %s", detail)
        ui.error_dialog(
            title=i18n.t("env_prep.title"),
            message=i18n.t("env_prep.message"),
            actions=[(i18n.t("common.ok"), "ok")],
            details=(
                f"Preparation of configuration in {repo} failed:\n{detail}\n\n"
                f"Expected template: {config.ENV_EXAMPLE_FILENAME}\n"
                f"Target: {config.ENV_FILENAME}"
            ),
            help_url=INSTALL_GUIDE_URL,
            initial_show_details=show_details,
        )
        return 1

    # 5. Installed-app management (#942 Bug 5). Three states:
    #    - running  -> Open / Stop / Uninstall
    #    - stopped  -> Start / Uninstall
    #    (not-installed was handled by the install flow above)
    display_port = config.resolve_launch_port(repo, cli_port=cli_port)
    if docker.stack_running(repo, config.COMPOSE_FILENAME):
        return _manage_running(repo, display_port)
    if not _offer_start_or_uninstall(repo):
        return 0  # user chose Uninstall or closed the menu

    # 6. Resolve the host port and make sure it is free BEFORE starting
    # the container (#942 Bug 3). If another app (e.g. Bibliogon) holds
    # the port, offer a free fallback and persist it so compose
    # publishes on the chosen port.
    port = _resolve_free_port(repo, cli_port)
    if port is None:
        return 1

    # 7. Launch the progress window, run docker compose + health wait +
    # browser on a background thread so the UI stays responsive.
    window = ui.StatusWindow(title=i18n.t("progress.title_start"))
    steps = [
        i18n.t("progress.step.docker"),
        i18n.t("progress.step.start"),
        i18n.t("progress.step.health"),
        i18n.t("progress.step.ready"),
    ]
    window.set_steps(steps)
    window.complete_step(0)  # Docker already verified above

    def worker() -> None:
        window.after(0, lambda: window.start_step(1, i18n.t("status.starting")))
        ok, up_detail = docker.compose_up(repo, config.COMPOSE_FILENAME)
        if not ok:
            logger.error("compose up failed: %s", up_detail)
            window.after(0, lambda: (window.fail_step(1), _handle_compose_failure(window, port, up_detail, show_details)))
            return
        window.after(0, lambda: window.complete_step(1))

        window.after(0, lambda: window.start_step(2, i18n.t("status.almost_ready")))
        if not health.wait_for_healthy(port, timeout_seconds=60.0):
            tail = docker.compose_logs_tail(repo, config.COMPOSE_FILENAME, lines=20)
            logger.error("health timeout; last lines:\n%s", tail)
            window.after(0, lambda: (window.fail_step(2), _handle_health_timeout(window, repo, port, tail, show_details)))
            return
        window.after(0, lambda: (window.complete_step(2), window.complete_step(3)))

        url = f"http://localhost:{port}"
        try:
            opened = webbrowser.open(url)
        except OSError as exc:
            logger.warning("webbrowser.open failed: %s", exc)
            opened = False
        if not opened:
            window.after(0, lambda: ui.ask_copyable_url(url))

        window.after(0, lambda: window.set_running(
            port,
            on_stop=lambda: _shutdown(window, repo),
            on_settings=_open_settings_dialog,
        ))
        # Non-blocking update check: fires after the main UI is running.
        # Any failure is swallowed inside update_check; the callback
        # schedules the notification on the main thread via window.after.
        _schedule_update_check(window, mdata)

    window.run_in_background(worker)

    # User-triggered close also runs shutdown (handler wired in StatusWindow).
    window.run_mainloop()
    return 0


# --- Step helpers ---


def _ensure_docker_ready(show_details: bool) -> bool:
    """Verify Docker is installed AND the daemon is running.

    This is the FIRST interactive step in the launcher (#942 Bug 1): the
    user must be told about the Docker requirement before any other
    dialog. Returns True once Docker is ready, False to abort.

    When the daemon is not running, the dialog offers a "Start Docker
    Desktop" button that launches Docker Desktop and then re-checks, so
    the user does not have to leave the launcher.
    """
    ok, detail = docker.docker_installed()
    if not ok:
        logger.error("docker --version failed: %s", detail)
        choice = ui.three_button_dialog(
            title=i18n.t("docker.missing.title"),
            message=(
                f"{i18n.t('docker.missing.heading')}\n\n"
                f"{i18n.t('docker.missing.explanation')}\n\n"
                f"{i18n.t('docker.missing.next_step')}"
            ),
            primary_label=i18n.t("docker.missing.install_button"),
            secondary_label=i18n.t("docker.missing.guide_button"),
            cancel_label=i18n.t("docker.missing.quit_button"),
        )
        if choice == "primary":
            _open_url(DOCKER_INSTALL_URL, "Docker download page")
        elif choice == "secondary":
            _open_url(_docker_guide_url(), "AdaptiveLearner Docker guide")
        return False

    # Daemon running? Loop until the user starts Docker or cancels.
    for attempt in range(10):
        ok, detail = docker.docker_daemon_running()
        if ok:
            return True
        logger.warning("docker info failed (attempt %d): %s", attempt + 1, detail)
        choice = ui.three_button_dialog(
            title=i18n.t("docker.daemon.title"),
            message=i18n.t("docker.daemon.message"),
            primary_label=i18n.t("docker.daemon.start_button"),
            secondary_label=i18n.t("common.retry"),
            cancel_label=i18n.t("common.cancel"),
        )
        if choice == "cancel":
            return False
        if choice == "primary":
            started, start_detail = docker.start_docker_desktop()
            logger.info("start Docker Desktop: ok=%s detail=%s", started, start_detail)
            if not started:
                ui.info_box(i18n.t("docker.daemon.title"), i18n.t("docker.daemon.start_failed"))
            else:
                # Give Docker Desktop time to come up, polling so the user
                # does not have to keep clicking Retry.
                if _wait_for_daemon(timeout_seconds=90.0):
                    return True
        # secondary == Retry, or start timed out: loop re-checks immediately.

    ui.error_dialog(
        title=i18n.t("docker.daemon.title"),
        message=i18n.t("docker.daemon.exhausted_message"),
        actions=[(i18n.t("common.ok"), "ok")],
        details="docker info did not become reachable.",
        help_url=INSTALL_GUIDE_URL,
        initial_show_details=show_details,
    )
    return False


def _wait_for_daemon(*, timeout_seconds: float) -> bool:
    """Poll ``docker info`` until it succeeds or the timeout elapses."""
    import time

    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        ok, _ = docker.docker_daemon_running()
        if ok:
            return True
        time.sleep(2.0)
    return False


def _resolve_free_port(repo: Path, cli_port: int | None) -> int | None:
    """Return a free host port, prompting the user on a conflict.

    Resolves the configured port (CLI > launcher.json > .env > default)
    and checks availability before ``docker compose up`` (#942 Bug 3).
    On a conflict it suggests the next free port; if the user accepts it
    is persisted to ``.env`` so compose publishes on it. Returns the
    chosen port, or None if the user cancels / no port is free.
    """
    port = config.resolve_launch_port(repo, cli_port=cli_port)
    if ports.is_available(port):
        return port

    suggested = ports.find_available(port + 1)
    if suggested is None:
        ui.error_box(
            i18n.t("port_conflict.none_free_title"),
            i18n.t("port_conflict.none_free_message", port=port),
        )
        return None

    choice = ui.two_button_dialog(
        title=i18n.t("port_conflict.title", port=port),
        message=i18n.t("port_conflict.message", port=port, suggested=suggested),
        primary_label=i18n.t("port_conflict.use_suggested", suggested=suggested),
        secondary_label=i18n.t("common.cancel"),
    )
    if choice != "primary":
        return None
    try:
        config.write_public_port(repo, suggested)
    except OSError as exc:
        logger.warning("could not persist chosen port to .env: %s", exc)
    logger.info("Port %d busy; using %d instead", port, suggested)
    return suggested


def _open_url(url: str, what: str) -> None:
    try:
        webbrowser.open(url)
    except OSError as exc:
        logger.warning("opening %s failed: %s", what, exc)


# --- Installed-app management (#942 Bug 5) ---


def _manage_running(repo: Path, port: int) -> int:
    """Management menu for a running stack: Open / Stop / Uninstall.

    Loops so that cancelling the uninstall confirmation returns to the
    menu instead of exiting. Closing the menu (X / Escape) is a no-op.
    """
    while True:
        action = ui.choice_dialog(
            title=i18n.t("manage.running.title"),
            message=i18n.t("manage.running.message", port=port),
            buttons=[
                (i18n.t("common.open_browser"), "open"),
                (i18n.t("manage.stop"), "stop"),
                (i18n.t("manage.uninstall"), "uninstall"),
            ],
        )
        if action == "open":
            _open_url(f"http://localhost:{port}", "AdaptiveLearner")
            return 0
        if action == "stop":
            _stop_stack(repo)
            return 0
        if action == "uninstall":
            if _quick_uninstall(repo):
                return 0
            continue  # uninstall cancelled -> back to the menu
        return 0  # menu closed


def _offer_start_or_uninstall(repo: Path) -> bool:
    """Menu for an installed-but-stopped app: Start / Uninstall.

    Returns True to proceed to the start flow, False if the user chose
    Uninstall or closed the menu.
    """
    action = ui.choice_dialog(
        title=i18n.t("manage.stopped.title"),
        message=i18n.t("manage.stopped.message"),
        buttons=[
            (i18n.t("manage.start"), "start"),
            (i18n.t("manage.uninstall"), "uninstall"),
        ],
    )
    if action == "start":
        return True
    if action == "uninstall":
        _quick_uninstall(repo)
    return False


def _stop_stack(repo: Path) -> None:
    """Stop the running stack, showing a brief progress window."""
    window = ui.StatusWindow(title=i18n.t("manage.stopping"))
    window.set_steps([i18n.t("manage.stop")])
    window.start_step(0, i18n.t("manage.stopping"))

    def worker() -> None:
        ok, detail = docker.compose_down(repo, config.COMPOSE_FILENAME)
        if not ok:
            logger.warning("stop failed: %s", detail)
            window.after(0, lambda: window.fail_step(0))
        else:
            window.after(0, lambda: window.complete_step(0))
        window.after(800, window.close)

    window.run_in_background(worker)
    window.run_mainloop()


def _quick_uninstall(repo: Path) -> bool:
    """Data-preserving uninstall (#942 Bug 5).

    Removes the containers and images but KEEPS the data volume, so the
    user's learning data survives a later reinstall. Returns True if the
    uninstall ran, False if the user cancelled the confirmation.
    """
    choice = ui.two_button_dialog(
        title=i18n.t("quick_uninstall.confirm_title"),
        message=i18n.t("quick_uninstall.confirm_message"),
        primary_label=i18n.t("manage.uninstall"),
        secondary_label=i18n.t("common.cancel"),
    )
    if choice != "primary":
        return False

    window = ui.StatusWindow(title=i18n.t("quick_uninstall.progress"))
    window.set_steps([i18n.t("manage.stop"), i18n.t("progress.step.build")])

    def worker() -> None:
        window.after(0, lambda: window.start_step(0, i18n.t("manage.stopping")))
        ok, detail = docker.compose_down(repo, config.COMPOSE_FILENAME)
        if not ok:
            logger.warning("quick-uninstall compose down: %s", detail)
        window.after(0, lambda: window.complete_step(0))

        window.after(0, lambda: window.start_step(1, i18n.t("uninstall.removing_images")))
        ok2, detail2 = docker.remove_images()
        if not ok2:
            logger.warning("quick-uninstall remove images: %s", detail2)
        window.after(0, lambda: window.complete_step(1))
        window.after(400, window.close)

    window.run_in_background(worker)
    window.run_mainloop()

    # Best-effort: drop a desktop/Start-menu shortcut if we can find one.
    _remove_desktop_shortcut()

    ui.two_button_dialog(
        title=i18n.t("quick_uninstall.complete_title"),
        message=i18n.t("quick_uninstall.complete_message"),
        primary_label=i18n.t("common.ok"),
        secondary_label="",
    )
    return True


def _remove_desktop_shortcut() -> None:
    """Best-effort removal of a launcher shortcut. Never raises.

    Only Windows ships a predictable shortcut location; elsewhere this is
    a no-op. A missing shortcut is fine - the user may have launched the
    executable directly.
    """
    import sys

    if sys.platform != "win32":
        return
    import os

    candidates: list[Path] = []
    public = os.environ.get("PUBLIC")
    appdata = os.environ.get("APPDATA")
    userprofile = os.environ.get("USERPROFILE")
    for base in (userprofile, public):
        if base:
            candidates.append(Path(base) / "Desktop" / "AdaptiveLearner.lnk")
    if appdata:
        candidates.append(
            Path(appdata)
            / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "AdaptiveLearner.lnk"
        )
    for shortcut in candidates:
        try:
            if shortcut.is_file():
                shortcut.unlink()
                logger.info("Removed shortcut: %s", shortcut)
        except OSError as exc:
            logger.warning("Could not remove shortcut %s: %s", shortcut, exc)


def _schedule_update_check(window: ui.StatusWindow, mdata: dict | None) -> None:
    """Kick off a background update check and surface a notification.

    Skipped silently if no manifest (AdaptiveLearner not installed) or the
    manifest has no version field. The update_check module handles
    all failure modes silently - this helper's only job is to wire
    the callback through window.after so the tkinter UI update runs
    on the main thread.
    """
    if not mdata:
        return
    current = mdata.get("version")
    if not current:
        return
    # User opt-out: respect the auto_update_check setting.
    if not settings.get("auto_update_check"):
        logger.info("Update check disabled by user setting.")
        return

    def on_update(tag: str, url: str) -> None:
        # Called on a background thread. Marshal the UI call to the
        # main thread via window.after so tkinter stays thread-safe.
        logger.info("Update available: %s (current: %s)", tag, current)
        window.after(0, lambda: _show_update_notification(tag, url, current))

    update_check.check_for_update_async(
        current_version=current,
        on_update_available=on_update,
    )


def _open_settings_dialog() -> None:
    """Open the Settings dialog, persist changes on Save."""
    current = settings.read_settings()
    updated = ui.settings_dialog(current)
    if updated is None:
        return  # user cancelled
    settings.write_settings(updated)
    logger.info("Settings saved: %s", {k: v for k, v in updated.items() if k in settings.DEFAULTS})


def _show_update_notification(tag: str, url: str, current: str) -> None:
    """Present the "new version available" dialog. Main thread only.

    Three choices: Open release page (primary) / Dismiss (secondary)
    / Don't check for updates (cancel - turns off auto_update_check).
    """
    choice = ui.three_button_dialog(
        title=i18n.t("update.title"),
        message=i18n.t("update.message", current=current, tag=tag),
        primary_label=i18n.t("update.primary"),
        secondary_label=i18n.t("update.dismiss"),
        cancel_label=i18n.t("update.disable"),
    )
    if choice == "primary":
        try:
            webbrowser.open(RELEASE_PAGE_URL)
        except OSError as exc:
            logger.warning("update release page open failed: %s", exc)
    elif choice == "cancel":
        # User opted out of future update checks.
        settings.update("auto_update_check", False)
        logger.info("Auto-update check disabled by user.")


def _retry_pending_cleanup() -> None:
    """Silently retry any incomplete uninstall from a previous session.

    Reads cleanup.json. For each step still marked False, retries it.
    Updates cleanup.json after each successful retry. Deletes the file
    when all steps are done. Never blocks or shows dialogs except a
    one-time warning if rmtree still fails (the user may need to
    delete the directory manually).
    """
    pending = manifest.read_cleanup_pending()
    if pending is None:
        return

    steps = pending.get("steps", {})
    install_dir = Path(pending.get("install_dir", ""))
    logger.info("Pending cleanup found from %s, retrying...", pending.get("pending_since", "?"))

    if not steps.get("compose_down"):
        ok, _ = docker.compose_down(install_dir, config.COMPOSE_FILENAME)
        manifest.update_cleanup_step("compose_down", ok)

    if not steps.get("remove_volumes"):
        ok, _ = docker.remove_volumes()
        manifest.update_cleanup_step("remove_volumes", ok)

    if not steps.get("remove_images"):
        ok, _ = docker.remove_images()
        manifest.update_cleanup_step("remove_images", ok)

    if not steps.get("rmtree"):
        ok, detail = installer.remove_install(install_dir)
        manifest.update_cleanup_step("rmtree", ok)
        if not ok and install_dir.exists():
            logger.warning("Pending rmtree still failed: %s", detail)
            ui.error_dialog(
                title=i18n.t("cleanup.title"),
                message=i18n.t("cleanup.message", path=str(install_dir)),
                actions=[(i18n.t("common.ok"), "ok")],
                details=detail,
                initial_show_details=config.get_show_details_default(),
            )

    if not steps.get("delete_manifest"):
        manifest.delete_manifest()
        manifest.update_cleanup_step("delete_manifest", True)

    # Check if everything is now done
    updated = manifest.read_cleanup_pending()
    if manifest.all_cleanup_done(updated):
        manifest.delete_cleanup_pending()
        logger.info("Pending cleanup completed successfully.")
    else:
        logger.warning("Pending cleanup still has incomplete steps.")


def _check_launcher_target_stale() -> bool:
    """Pre-install safeguard: warn the user if this launcher targets
    an older AdaptiveLearner than the latest published release.

    Returns True if the install flow may proceed (target is current,
    or the user explicitly chose "Continue with older version", or
    the network check failed open). Returns False if the install
    must abort (user chose "Open download page" or "Cancel").

    Always runs regardless of the ``auto_update_check`` toggle: the
    toggle governs only the post-install notification check.
    First-install on a fresh machine is special; a stale target
    here causes destructive misalignment (user gets an outdated
    AdaptiveLearner).

    Strict-newer comparison: any newer release fires the dialog.
    The "Continue with older version" button preserves agency for
    users who deliberately want the older version (e.g. testing,
    pinned compatibility). Network failure is fail-open so a
    GitHub outage cannot block fresh installs.
    """
    latest = update_check.fetch_latest_version()
    if latest is None:
        return True  # fail-open

    tag, _url = latest
    if not update_check.is_newer(installer.ADAPTIVE_LEARNER_TARGET_VERSION, tag):
        return True  # in sync (or this launcher is ahead, weird but proceed)

    choice = ui.three_button_dialog(
        title=i18n.t("stale.title"),
        message=i18n.t(
            "stale.message",
            target=installer.ADAPTIVE_LEARNER_TARGET_VERSION,
            latest=tag,
        ),
        primary_label=i18n.t("stale.download"),
        secondary_label=i18n.t("stale.continue_old"),
        cancel_label=i18n.t("common.cancel"),
    )
    if choice == "primary":
        try:
            webbrowser.open(RELEASE_PAGE_URL)
        except OSError as exc:
            logger.warning("opening release page failed: %s", exc)
        return False  # abort install
    if choice == "cancel":
        return False  # abort install
    # secondary: user knows what they're doing, proceed
    return True


def _install_or_welcome() -> Path | None:
    """Offer to install AdaptiveLearner or open the install guide.

    Used for the no-manifest case: either a brand-new install or a
    re-install after the user removed the previous one. The pre-
    requisites story (Docker, sizes, trust anchor) was already
    delivered by the welcome dialog at the top of ``_run_launcher``,
    so this prompt is intentionally short - just an Install / Open
    guide / Cancel choice.

    Returns the install directory on success, or None if the user
    cancelled or only opened the guide.
    """
    if not _check_launcher_target_stale():
        return None  # user opted to abort due to outdated launcher

    choice = ui.three_button_dialog(
        title=i18n.t("install_prompt.title"),
        message=i18n.t("install_prompt.message"),
        primary_label=i18n.t("install_prompt.install_button"),
        secondary_label=i18n.t("install_prompt.guide_button"),
        cancel_label=i18n.t("install_prompt.cancel_button"),
    )
    if choice == "cancel":
        return None
    if choice == "secondary":
        try:
            webbrowser.open(INSTALL_GUIDE_URL)
        except OSError as exc:
            logger.warning("opening install guide failed: %s", exc)
        return None

    # User chose "Install" -> pick folder, download, extract
    return _run_install_flow()


def _run_install_flow() -> Path | None:
    """Download and install AdaptiveLearner, returning the install dir on success."""
    show_details = config.get_show_details_default()
    target = config.default_repo_path()

    # Let user pick a custom folder (pre-filled with default)
    picked = ui.pick_folder(i18n.t("install.choose_folder"), initial_dir=str(target.parent))
    if picked is None:
        return None
    target = Path(picked) if picked else target

    # Show progress window with a step checklist during install.
    window = ui.StatusWindow(title=i18n.t("progress.title_install"))
    window.set_steps([
        i18n.t("progress.step.docker"),
        i18n.t("progress.step.download"),
        i18n.t("progress.step.build"),
        i18n.t("progress.step.health"),
        i18n.t("progress.step.ready"),
    ])
    window.complete_step(0)  # Docker already verified before the install flow

    result: dict = {}

    def worker() -> None:
        # Phase 1: Download and extract
        window.after(0, lambda: window.start_step(1, i18n.t("install.downloading", version=f"v{installer.ADAPTIVE_LEARNER_TARGET_VERSION}")))
        ok, detail = installer.download_release(target)
        if not ok:
            result["error"] = detail
            window.after(0, lambda: (window.fail_step(1), window.close()))
            return
        window.after(0, lambda: window.complete_step(1))
        ok2, detail2 = installer.create_env_file(target)
        if not ok2:
            logger.warning("env file creation: %s", detail2)
        # Write manifest
        try:
            manifest.write_manifest(target, installer.ADAPTIVE_LEARNER_TARGET_VERSION)
        except Exception as exc:
            result["error"] = f"Could not write manifest: {exc}"
            window.after(0, lambda: (window.fail_step(1), window.close()))
            return
        # Save to legacy config too for backward compat
        cfg = config.load_launcher_config()
        cfg["repo_path"] = str(target)
        config.save_launcher_config(cfg)

        # Phase 2: Build and start Docker stack
        window.after(0, lambda: window.start_step(2, i18n.t("install.building_images")))
        ok3, detail3 = docker.compose_build(target, config.COMPOSE_FILENAME)
        if not ok3:
            result["error"] = f"Docker build failed:\n{detail3}"
            window.after(0, lambda: (window.fail_step(2), window.close()))
            return
        window.after(0, lambda: window.complete_step(2))

        # Phase 3: Wait for health
        window.after(0, lambda: window.start_step(3, i18n.t("install.waiting_health")))
        port = config.read_public_port(target)
        if not health.wait_for_healthy(port, timeout_seconds=120.0):
            # Not fatal: stack may still be starting
            result["slow_start"] = True
        window.after(0, lambda: (window.complete_step(3), window.complete_step(4)))

        result["ok"] = True
        result["port"] = port
        window.after(0, window.close)

    window.run_in_background(worker)
    window.run_mainloop()

    if result.get("error"):
        ui.error_dialog(
            title=i18n.t("install.failed.title"),
            message=i18n.t("install.failed.message"),
            actions=[(i18n.t("common.ok"), "ok")],
            details=result["error"],
            initial_show_details=show_details,
        )
        return None

    if result.get("ok"):
        port = result.get("port", config.DEFAULT_PORT)
        version_label = f"v{installer.ADAPTIVE_LEARNER_TARGET_VERSION}"
        if result.get("slow_start"):
            choice = ui.two_button_dialog(
                title=i18n.t("install.complete.title"),
                message=i18n.t(
                    "install.complete.slow_message", version=version_label
                ),
                primary_label=i18n.t("common.open_browser"),
                secondary_label=i18n.t("common.close"),
            )
        else:
            choice = ui.two_button_dialog(
                title=i18n.t("install.complete.title"),
                message=i18n.t(
                    "install.complete.ok_message",
                    version=version_label,
                    port=port,
                ),
                primary_label=i18n.t("common.open_browser"),
                secondary_label=i18n.t("common.close"),
            )
        if choice == "primary":
            try:
                webbrowser.open(f"http://localhost:{port}")
            except OSError as exc:
                logger.warning("browser open failed: %s", exc)
        return target

    return None


def _run_uninstall_flow(install_dir: Path) -> bool:
    """Uninstall AdaptiveLearner after user confirmation. Returns True if uninstalled."""
    show_details = config.get_show_details_default()
    choice = ui.two_button_dialog(
        title=i18n.t("uninstall.title"),
        message=i18n.t("uninstall.message", path=str(install_dir)),
        primary_label=i18n.t("uninstall.confirm"),
        secondary_label=i18n.t("common.cancel"),
    )
    if choice != "primary":
        return False

    # Write cleanup state BEFORE any destructive operation so a crash
    # or abort mid-uninstall can be retried on next launcher start.
    manifest.write_cleanup_pending(install_dir)

    # Phase 1: Stop Docker stack (best-effort, continue if Docker is not running)
    window = ui.StatusWindow()
    window.set_starting(i18n.t("uninstall.stopping"))

    def uninstall_worker() -> None:
        ok, detail = docker.compose_down(install_dir, config.COMPOSE_FILENAME)
        manifest.update_cleanup_step("compose_down", ok)
        if not ok:
            logger.warning("compose down: %s", detail)

        window.after(0, lambda: window.set_starting(i18n.t("uninstall.removing_volumes")))
        ok2, detail2 = docker.remove_volumes()
        manifest.update_cleanup_step("remove_volumes", ok2)
        if not ok2:
            logger.warning("remove volumes: %s", detail2)

        window.after(0, lambda: window.set_starting(i18n.t("uninstall.removing_images")))
        ok3, detail3 = docker.remove_images()
        manifest.update_cleanup_step("remove_images", ok3)
        if not ok3:
            logger.warning("remove images: %s", detail3)

        window.after(0, window.close)

    window.run_in_background(uninstall_worker)
    window.run_mainloop()

    # Phase 2: Remove install directory
    ok, detail = installer.remove_install(install_dir)
    manifest.update_cleanup_step("rmtree", ok)
    if not ok:
        ui.error_dialog(
            title=i18n.t("uninstall.failed.title"),
            message=i18n.t("uninstall.failed.message"),
            actions=[(i18n.t("common.ok"), "ok")],
            details=detail,
            initial_show_details=show_details,
        )
        return False

    # Phase 3: Clean up manifest and legacy config
    manifest.delete_manifest()
    manifest.update_cleanup_step("delete_manifest", True)
    try:
        cfg = config.load_launcher_config()
        cfg.pop("repo_path", None)
        config.save_launcher_config(cfg)
    except Exception:
        pass

    # All steps done: remove cleanup state file
    manifest.delete_cleanup_pending()

    ui.two_button_dialog(
        title=i18n.t("uninstall.complete.title"),
        message=i18n.t("uninstall.complete.message"),
        primary_label=i18n.t("common.ok"),
        secondary_label="",
    )
    return True


def _installation_moved_picker() -> Path | None:
    """AdaptiveLearner was launched here before but the remembered folder no
    longer resolves. Offer folder picker or install guide.

    Three buttons: Choose folder / Open install guide / Cancel.
    """
    while True:
        choice = ui.three_button_dialog(
            title=i18n.t("moved.title"),
            message=i18n.t("moved.message"),
            primary_label=i18n.t("moved.choose_folder"),
            secondary_label=i18n.t("install_prompt.guide_button"),
            cancel_label=i18n.t("common.cancel"),
        )
        if choice == "cancel":
            return None
        if choice == "secondary":
            try:
                webbrowser.open(INSTALL_GUIDE_URL)
            except OSError as exc:
                logger.warning("opening install guide failed: %s", exc)
            return None
        picked = ui.pick_folder(i18n.t("moved.choose_folder_picker"))
        if picked is None:
            continue  # back to the three-button dialog
        repo = Path(picked)
        if config.is_valid_repo(repo):
            cfg = config.load_launcher_config()
            cfg["repo_path"] = str(repo)
            config.save_launcher_config(cfg)
            return repo
        retry = ui.ask_retry_quit(
            i18n.t("moved.invalid_title"),
            i18n.t("moved.invalid_message"),
        )
        if not retry:
            return None


def _ensure_env_file(repo: Path) -> tuple[bool, str]:
    """Create the configuration file on first run. Details go to the log."""
    env_file = repo / config.ENV_FILENAME
    if env_file.is_file():
        return True, "ok"
    example = repo / config.ENV_EXAMPLE_FILENAME
    if not example.is_file():
        return False, f"neither {config.ENV_FILENAME} nor {config.ENV_EXAMPLE_FILENAME} exist in {repo}"
    try:
        shutil.copyfile(example, env_file)
    except OSError as exc:
        return False, f"copy failed: {exc}"
    try:
        _replace_secret_placeholder(env_file)
    except OSError as exc:
        return False, f"secret generation failed: {exc}"
    return True, "created"


def _replace_secret_placeholder(env_file: Path) -> None:
    import secrets
    text = env_file.read_text(encoding="utf-8")
    text = text.replace("change-me-to-a-random-secret", secrets.token_hex(32))
    env_file.write_text(text, encoding="utf-8")


def _handle_compose_failure(window: ui.StatusWindow, port: int, detail: str, show_details: bool) -> None:
    ui.error_dialog(
        title=i18n.t("start.compose_failed.title"),
        message=i18n.t("start.compose_failed.message", port=port),
        actions=[(i18n.t("common.ok"), "ok")],
        details=f"docker compose -f {config.COMPOSE_FILENAME} up -d failed:\n{detail}",
        help_url=INSTALL_GUIDE_URL,
        initial_show_details=show_details,
    )
    window.close()


def _handle_health_timeout(
    window: ui.StatusWindow,
    repo: Path,
    port: int,
    tail: str,
    show_details: bool,
) -> None:
    choice = ui.error_dialog(
        title=i18n.t("start.health_timeout.title"),
        message=i18n.t("start.health_timeout.message"),
        actions=[(i18n.t("common.retry"), "retry"), (i18n.t("common.cancel"), "cancel")],
        details=(
            f"GET http://localhost:{port}/api/health did not respond in 60 s.\n\n"
            f"Last 20 log lines from docker compose -f {config.COMPOSE_FILENAME}:\n{tail}"
        ),
        help_url=INSTALL_GUIDE_URL,
        initial_show_details=show_details,
    )
    if choice == "retry":
        if health.wait_for_healthy(port, timeout_seconds=60.0):
            url = f"http://localhost:{port}"
            webbrowser.open(url)
            window.set_running(port, on_stop=lambda: _shutdown(window, repo))
            return
    docker.compose_down(repo, config.COMPOSE_FILENAME)
    window.close()


def _shutdown(window: ui.StatusWindow, repo: Path) -> None:
    window.set_stopping()
    ok, detail = docker.compose_down(repo, config.COMPOSE_FILENAME)
    if not ok:
        logger.warning("shutdown failed: %s", detail)
    window.close()


def _handle_already_running() -> None:
    """Another launcher instance is alive, so the app is running.

    Offer the same management menu as the running-state path (Open /
    Stop / Uninstall) instead of only opening the browser (#942 Bug 5).
    """
    repo = config.resolve_repo_path()
    port = config.read_public_port(repo) if config.is_valid_repo(repo) else config.DEFAULT_PORT
    if config.is_valid_repo(repo):
        _manage_running(repo, port)
    else:
        ui.info_box(
            i18n.t("already_running.title"),
            i18n.t("already_running.message"),
        )
        _open_url(f"http://localhost:{port}", "AdaptiveLearner")


def _setup_logging(*, debug: bool = False) -> None:
    from logging.handlers import RotatingFileHandler

    root = logging.getLogger()
    root.setLevel(logging.DEBUG if debug else logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")

    # Handler 1: legacy launcher.log under APPDATA/AdaptiveLearner/
    legacy_path = config.logfile_path()
    legacy_path.parent.mkdir(parents=True, exist_ok=True)
    legacy_handler = logging.FileHandler(str(legacy_path), encoding="utf-8")
    legacy_handler.setFormatter(fmt)
    root.addHandler(legacy_handler)

    # Handler 2: install.log under platformdirs config dir (lowercase
    # "adaptive_learner"), rotated at 1 MB. This is the activity log that
    # records install/uninstall events for troubleshooting.
    try:
        activity_path = manifest.manifest_path().parent / "install.log"
        activity_path.parent.mkdir(parents=True, exist_ok=True)
        activity_handler = RotatingFileHandler(
            str(activity_path), maxBytes=1_000_000, backupCount=1, encoding="utf-8",
        )
        activity_handler.setFormatter(fmt)
        root.addHandler(activity_handler)
    except OSError:
        pass  # Never crash because activity logging setup failed

    if debug:
        _add_debug_handlers(root, fmt)


def _add_debug_handlers(root: logging.Logger, fmt: logging.Formatter) -> None:
    """Attach the ``--debug`` handlers: stdout plus a CWD debug log.

    ``launcher-debug.log`` is written to the current working directory
    (where the user runs ``python -m adaptive_learner_launcher``) and
    truncated on each debug run so a fresh capture is easy to share.
    Failures are swallowed: a missing-permission CWD must never block
    the launcher from starting.
    """
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(fmt)
    stdout_handler.setLevel(logging.DEBUG)
    root.addHandler(stdout_handler)

    try:
        debug_path = Path.cwd() / "launcher-debug.log"
        debug_handler = logging.FileHandler(str(debug_path), mode="w", encoding="utf-8")
        debug_handler.setFormatter(fmt)
        debug_handler.setLevel(logging.DEBUG)
        root.addHandler(debug_handler)
        logger.debug("Debug log: %s", debug_path)
    except OSError as exc:
        logger.warning("could not open launcher-debug.log: %s", exc)


if __name__ == "__main__":
    sys.exit(main())
