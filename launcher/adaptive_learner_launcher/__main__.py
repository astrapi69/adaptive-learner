"""Launcher entry point (#1045).

The persistent window (:mod:`launcher_app`) is the SOLE GUI entry point for
EVERY launch - source checkouts AND frozen binaries, on Linux, macOS and
Windows. There is no frozen-vs-source branch and no old dialog chain: the
window downloads the release itself when there is no local repo (see
:func:`actions.ensure_installed`). Headless CLI actions (``--install`` etc.)
still route straight through the actions layer.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from adaptive_learner_launcher import __version__, actions, config, i18n, manifest, settings


logger = logging.getLogger("adaptive_learner_launcher")


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
    parser.add_argument(
        "--version", action="store_true",
        help="Print the launcher version and exit.",
    )
    # Headless action flags (CLI<->GUI parity). Each routes through actions.
    parser.add_argument("--check", action="store_true", help="Check Docker status and exit.")
    parser.add_argument("--status", action="store_true", help="Print app state (running/stopped/...) and exit.")
    parser.add_argument("--install", action="store_true", help="Build + start the app and exit.")
    parser.add_argument("--start", action="store_true", help="Start the stopped app and exit.")
    parser.add_argument("--stop", action="store_true", help="Stop the running app and exit.")
    parser.add_argument("--uninstall", action="store_true", help="Remove the app containers/images and exit.")
    parser.add_argument("--open", action="store_true", help="Open the app in the browser and exit.")
    parser.add_argument("--window", action="store_true", help="Open the persistent launcher window (preview).")
    parser.print_help()
    return True


def _maybe_show_version(argv: list[str] | None = None) -> bool:
    """Print the version when ``--version`` was requested.

    Returns True when the version was shown (the caller then exits).
    """
    args = sys.argv[1:] if argv is None else argv
    if "--version" not in args:
        return False
    print(f"adaptive_learner_launcher {__version__}")
    return True


def _cli_action_config() -> dict:
    """Resolve {project, compose_file, port} for headless CLI actions."""
    repo = config.source_checkout_repo() or manifest.install_dir_from_manifest() or config.resolve_repo_path()
    return {
        "project": actions.DEFAULT_PROJECT,
        "compose_file": str(repo / config.COMPOSE_FILENAME),
        "port": config.read_public_port(repo) if repo else actions.DEFAULT_PORT,
    }


def _maybe_run_cli_action(argv: list[str]) -> int | None:
    """Route a headless CLI action through the actions layer.

    Returns an exit code when an action flag was handled, or ``None`` when
    no action flag was present (the caller then launches the GUI). Every
    branch calls ONLY ``actions.*`` - no business logic lives here.
    """
    import argparse

    parser = argparse.ArgumentParser(add_help=False)
    for flag in ("check", "status", "install", "start", "stop", "uninstall", "open"):
        parser.add_argument(f"--{flag}", action="store_true")
    try:
        args, _ = parser.parse_known_args(argv)
    except SystemExit:
        return None

    cfg = _cli_action_config()
    if args.check:
        ok, msg = actions.check_docker()
        print(msg)
        return 0 if ok else 1
    if args.status:
        print(f"Status: {actions.get_state(cfg['project'])}")
        return 0
    if args.install:
        ok, msg = actions.install(cfg["compose_file"], cfg["project"], cfg["port"],
                                  on_step=lambda label: print(label))
        print(msg)
        return 0 if ok else 1
    if args.start:
        ok, msg = actions.start(cfg["compose_file"], cfg["project"])
        print(msg)
        return 0 if ok else 1
    if args.stop:
        ok, msg = actions.stop(cfg["project"])
        print(msg)
        return 0 if ok else 1
    if args.uninstall:
        ok, msg = actions.uninstall(cfg["project"])
        print(msg)
        return 0 if ok else 1
    if args.open:
        actions.open_browser(cfg["port"])
        return 0
    return None


def main() -> int:
    if _maybe_show_help(sys.argv[1:]):
        return 0
    if _maybe_show_version(sys.argv[1:]):
        return 0

    debug = _parse_cli_debug(sys.argv[1:])
    _setup_logging(debug=debug)

    action_rc = _maybe_run_cli_action(sys.argv[1:])
    if action_rc is not None:
        return action_rc

    logger.info("AdaptiveLearner launcher v%s starting", __version__)
    if debug:
        logger.debug("Debug mode enabled (verbose logging to launcher-debug.log)")

    # #1045 - the persistent window is the ONLY GUI entry point, for source
    # checkouts AND frozen binaries alike (the window downloads the release
    # itself when there is no local repo). No frozen-vs-source branch, no
    # dialog-chain fallback - ONE code path on every platform.
    cli_port = _parse_cli_port(sys.argv[1:])
    if cli_port is not None:
        logger.info("Host port set via --port %d", cli_port)
        try:
            actions.set_port(config.launcher_config_path(), cli_port)
        except Exception as exc:  # noqa: BLE001 - port persistence is best-effort
            logger.warning("could not persist --port: %s", exc)

    try:
        i18n.init(settings.get("language"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("i18n init failed, continuing in English: %s", exc)

    from adaptive_learner_launcher import launcher_app
    return launcher_app.run_app()


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
