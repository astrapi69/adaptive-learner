"""Adaptive Learner launcher entry point.

The launcher implementation now lives in the published
``docker-app-launcher`` PyPI package (#1064); this module is a thin
wrapper that points the package at Adaptive Learner's ``launcher.json``
and preserves the app version string on ``--version`` (the package would
otherwise report its own version).

All behaviour - the persistent window, the Docker-first flow, the
``--check`` / ``--status`` / ``--install`` / ``--start`` / ``--stop`` /
``--uninstall`` / ``--cleanup`` / ``--open`` CLI verbs, the system tray,
and i18n - is provided by ``docker_app_launcher``. Configuration is data
in ``launcher.json``, not code here.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from docker_app_launcher.__main__ import main as _package_main

from adaptive_learner_launcher import __version__

# launcher.json sits at the launcher/ root, beside this package directory.
# Resolving from __file__ makes the launcher work from any CWD. In the
# frozen one-file build the entry module's ``__file__`` is
# ``_MEIPASS/__main__.py`` (NO package subdirectory), so the source-checkout
# arithmetic ``parent.parent / launcher.json`` would escape the bundle
# (e.g. ``/tmp/launcher.json``) and the fail-open package config loader
# would silently fall back to the all-defaults "My App" branding (#2027).
_PACKAGE_DIR = Path(__file__).resolve().parent


def _bundle_root() -> Path | None:
    """Return the PyInstaller extraction root when frozen, else ``None``."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", _PACKAGE_DIR))
    return None


def _config_path() -> Path:
    """Locate ``launcher.json`` for both run modes (#2027).

    Frozen one-file binary: the spec bundles it at the bundle root
    (``_MEIPASS/launcher.json``). Source checkout: it sits at the
    ``launcher/`` root beside this package directory.
    """
    root = _bundle_root()
    if root is not None:
        return root / "launcher.json"
    return _PACKAGE_DIR.parent / "launcher.json"


# The Compose stack the launcher manages. docker-app-launcher resolves the
# compose file - and writes the ``.env`` the published host port lives in -
# relative to the current working directory (it carries no ``install_dir``).
# So the launcher MUST run with the repo as its CWD, or a port change writes
# ``.env`` somewhere Compose never reads and the app is unreachable on the new
# port (docker-app-launcher#3).
_COMPOSE_FILE = "docker-compose.prod.yml"


def _resolve_app_dir() -> Path | None:
    """Find the directory holding the Compose stack, or ``None``.

    A static ``install_dir`` cannot be committed: the repo lives wherever the
    user installed it. Instead we probe, first match wins:

    1. ``$ADAPTIVE_LEARNER_DIR`` - the install-location override ``install.sh``
       already honours;
    2. the repo root of a source checkout (two levels above this package), so
       ``python -m adaptive_learner_launcher`` works from a dev tree;
    3. ``~/adaptive-learner`` - ``install.sh``'s default clone location.

    Only a candidate that actually contains :data:`_COMPOSE_FILE` is returned;
    when none does (e.g. the user already launched from the repo, or a frozen
    binary sitting beside it) the CWD is left untouched.
    """
    candidates: list[Path] = []
    env_dir = os.environ.get("ADAPTIVE_LEARNER_DIR")
    if env_dir:
        candidates.append(Path(env_dir).expanduser())
    candidates.append(_PACKAGE_DIR.parent.parent)  # <repo>/launcher/<package>/ -> <repo>
    candidates.append(Path.home() / "adaptive-learner")
    for candidate in candidates:
        if (candidate / _COMPOSE_FILE).is_file():
            return candidate
    return None


def main(argv: list[str] | None = None) -> int:
    """Delegate to docker-app-launcher with Adaptive Learner's config.

    Returns a process exit code. ``--version`` reports the Adaptive
    Learner launcher version; everything else routes through the package.
    Before delegating, the working directory is moved to the Compose stack
    (when found) so the package resolves the compose file and writes ``.env``
    next to it.
    """
    args = list(sys.argv[1:] if argv is None else argv)
    if "--version" in args:
        print(f"adaptive_learner_launcher {__version__}")
        return 0
    app_dir = _resolve_app_dir()
    if app_dir is not None:
        os.chdir(app_dir)
    else:
        # Standalone frozen run (no repo checkout found anywhere): run from
        # the bundle root so the config-relative window icon bundled by the
        # spec resolves (#2027). A CWD that already carries the compose file
        # (a user launching from inside their own clone) is left untouched -
        # the package resolves the stack there.
        bundle = _bundle_root()
        if bundle is not None and not (Path.cwd() / _COMPOSE_FILE).is_file():
            os.chdir(bundle)
    if not any(arg == "--config" or arg.startswith("--config=") for arg in args):
        args = ["--config", str(_config_path()), *args]
    return _package_main(args)


if __name__ == "__main__":
    raise SystemExit(main())
