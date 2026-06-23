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

import sys
from pathlib import Path

from docker_app_launcher.__main__ import main as _package_main

from adaptive_learner_launcher import __version__

# launcher.json sits at the launcher/ root, beside this package directory.
# Resolving from __file__ makes the launcher work from any CWD (and the
# PyInstaller spec bundles launcher.json next to the executable).
_CONFIG_PATH = Path(__file__).resolve().parent.parent / "launcher.json"


def main(argv: list[str] | None = None) -> int:
    """Delegate to docker-app-launcher with Adaptive Learner's config.

    Returns a process exit code. ``--version`` reports the Adaptive
    Learner launcher version; everything else routes through the package.
    """
    args = list(sys.argv[1:] if argv is None else argv)
    if "--version" in args:
        print(f"adaptive_learner_launcher {__version__}")
        return 0
    if not any(arg == "--config" or arg.startswith("--config=") for arg in args):
        args = ["--config", str(_CONFIG_PATH), *args]
    return _package_main(args)


if __name__ == "__main__":
    raise SystemExit(main())
