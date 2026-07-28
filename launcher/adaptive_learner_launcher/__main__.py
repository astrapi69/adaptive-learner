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

import io
import json
import os
import shutil
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

from docker_app_launcher.__main__ import main as _package_main

from adaptive_learner_launcher import __version__, bundle_manifest, deployment_assets

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


def _download(url: str, timeout: float = 60.0):
    """Open ``url`` for reading (seam for the bootstrap tests)."""
    return urllib.request.urlopen(url, timeout=timeout)  # noqa: S310 - fixed https URL


def _bootstrap_app_source() -> Path | int:
    """Provision the tagged source tree for a standalone frozen run (#2054).

    The engine has no download step (the compose lifecycle needs the whole
    source tree as build context, which cannot live inside a one-file
    binary), so the wrapper restores the documented "Download" step: fetch
    the GitHub tag archive matching the wrapper's own app version and
    unpack it to ``$ADAPTIVE_LEARNER_DIR`` (default ``~/adaptive-learner``).

    Returns the provisioned directory, or an exit code on failure (hard
    and named, #32 philosophy - never a silent fall-through to a broken
    compose lookup in ``_MEIPASS``).
    """
    try:
        app_version = str(json.loads(_config_path().read_text(encoding="utf-8"))["app_version"])
    except (OSError, ValueError, KeyError) as exc:
        print(f"Cannot read app_version from {_config_path()}: {exc}", file=sys.stderr)
        return 4
    target = Path(os.environ.get("ADAPTIVE_LEARNER_DIR") or "~/adaptive-learner").expanduser()
    url = f"https://github.com/astrapi69/adaptive-learner/archive/refs/tags/v{app_version}.tar.gz"
    print(f"Downloading the Adaptive Learner v{app_version} source tree ...")
    try:
        with _download(url) as resp:
            payload = resp.read()
    except Exception as exc:  # noqa: BLE001 - any network failure ends the run
        print(
            f"Could not download {url}: {exc}\n"
            f"Provision the source manually instead: run install.sh, or\n"
            f"git clone https://github.com/astrapi69/adaptive-learner {target}\n"
            f"(or point ADAPTIVE_LEARNER_DIR at an existing checkout).",
            file=sys.stderr,
        )
        return 4
    root_dir = f"adaptive-learner-{app_version}"
    try:
        with tempfile.TemporaryDirectory() as tmp:
            with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as tar:
                try:
                    tar.extractall(tmp, filter="data")
                except TypeError:  # pragma: no cover - Python without tar filters
                    tar.extractall(tmp)  # noqa: S202 - trusted fixed-URL archive
            extracted = Path(tmp) / root_dir
            if not (extracted / _COMPOSE_FILE).is_file():
                print(f"Archive {url} carries no {_COMPOSE_FILE}.", file=sys.stderr)
                return 4
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                print(
                    f"{target} exists but holds no {_COMPOSE_FILE}; refusing to overwrite it.\n"
                    f"Move it away or point ADAPTIVE_LEARNER_DIR elsewhere.",
                    file=sys.stderr,
                )
                return 4
            shutil.move(str(extracted), str(target))
    except (OSError, tarfile.TarError) as exc:
        print(f"Could not unpack the source archive: {exc}", file=sys.stderr)
        return 4
    print(f"Source tree ready at {target}.")
    return target


ANCHORED_CONFIG_NAME = ".adaptive-learner-launcher.json"


def _anchored_config_path(app_dir: Path) -> Path:
    """Return a config whose ``install_dir`` points at the real app tree.

    ``docker-app-launcher`` 0.21.0 bases app-relative paths on the config
    file's own directory when the config carries no ``install_dir``
    (upstream #64, ``config.py:426``). Frozen, that directory is the
    PyInstaller bundle, so ``backend/Dockerfile`` and
    ``docker-compose.prod.yml`` both resolve under ``/tmp/_MEIxxxx`` -
    no matter that the wrapper has just chdir'd into a complete source
    tree (#2109). Both deployment modes broke on it, and the GUI hits it
    without ever passing an action argument.

    Rather than leave the base to an accident of where the config file
    happens to sit, the bundled config is written next to the app tree
    with ``install_dir`` set explicitly. An explicit value wins over the
    derived one, so the resolution lands where the files actually are.

    Falls back to the bundled path when the copy cannot be written (a
    read-only app dir); the readiness guard then reports the real cause
    instead of the package blaming the settings.
    """
    source = _config_path()
    if not source.is_file():
        return source
    try:
        data = json.loads(source.read_text(encoding="utf-8"))
        data["install_dir"] = str(app_dir)
        target = app_dir / ANCHORED_CONFIG_NAME
        target.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return target
    except (OSError, json.JSONDecodeError):
        return source


def _deployment_readiness_problem(*, config_file: Path | None = None) -> list[str] | None:
    """Diagnose an unrunnable deployment mode BEFORE claiming to install.

    ``docker-app-launcher`` 0.21.0 bases app-relative paths on the config
    file's own directory (upstream #64). Frozen, that directory is the
    PyInstaller bundle, so ``backend/Dockerfile`` resolves to
    ``/tmp/_MEIxxxx/backend/Dockerfile`` even when a complete source tree
    sits at the working directory (#2109).

    The package's own message for that state points at the deployment
    settings, which is the wrong cause: the config is right and the
    resolution is wrong. This returns the honest diagnosis instead, or
    ``None`` when the mode can run.
    """
    config_file = config_file or _config_path()
    if not config_file.is_file():
        return None  # a missing config is already handled, loudly, upstream
    try:
        raw = json.loads(config_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None  # malformed config is upstream's hard error to report

    base = Path(raw["install_dir"]) if raw.get("install_dir") else config_file.resolve().parent
    report = deployment_assets.check(
        mode=raw.get("deployment_mode") or "compose",
        base=base,
        compose_file=raw.get("compose_file") or _COMPOSE_FILE,
        dockerfile=raw.get("dockerfile_file") or "backend/Dockerfile",
        build_context=raw.get("build_context") or ".",
        elsewhere=[Path.cwd()],
    )
    if report.ok:
        return None
    return report.explain()


def main(argv: list[str] | None = None) -> int:
    """Delegate to docker-app-launcher with Adaptive Learner's config.

    Returns a process exit code. ``--version`` reports the Adaptive
    Learner launcher version; ``--verify-bundle`` checks the frozen
    bundle against the asset manifest; everything else routes through
    the package. Before delegating, the working directory is moved to
    the Compose stack - found, or freshly provisioned (#2054) - so the
    package resolves the compose file and writes ``.env`` next to it.
    """
    args = list(sys.argv[1:] if argv is None else argv)
    if "--version" in args:
        print(f"adaptive_learner_launcher {__version__}")
        return 0
    bundle = _bundle_root()
    if "--verify-bundle" in args:
        if bundle is None:
            print("Not a frozen binary - nothing to verify.")
            return 0
        missing = bundle_manifest.missing_assets(bundle)
        for path in missing:
            print(f"missing bundle asset: {path}", file=sys.stderr)
        if missing:
            return 3
        print("Bundle complete.")
        return 0
    if bundle is not None:
        # Fail loudly BEFORE the engine starts when the bundle is
        # incomplete - the full gap list in one run (#2054, #32
        # philosophy), instead of one stray path per device session.
        missing = bundle_manifest.missing_assets(bundle)
        if missing:
            for path in missing:
                print(f"missing bundle asset: {path}", file=sys.stderr)
            return 3
    app_dir = _resolve_app_dir()
    if app_dir is not None:
        os.chdir(app_dir)
    else:
        # Standalone frozen run, no repo checkout anywhere. A CWD that
        # already carries the compose file (a user launching from inside
        # their own clone) keeps priority; otherwise provision the tagged
        # source tree and run from it (#2054) - the former
        # chdir-to-bundle-root fallback only relocated the missing-compose
        # failure into /tmp/_MEI*.
        if bundle is not None and not (Path.cwd() / _COMPOSE_FILE).is_file():
            provisioned = _bootstrap_app_source()
            if isinstance(provisioned, int):
                return provisioned
            os.chdir(provisioned)
    if not any(arg == "--config" or arg.startswith("--config=") for arg in args):
        args = ["--config", str(_anchored_config_path(Path.cwd())), *args]
    # Only the actions that actually build or start need the mode's assets.
    # --status / --stop / --uninstall must keep working on a broken install,
    # and the window must still open so the user can read the diagnosis.
    # The GUI passes no action argument at all - and the window's Install
    # button is exactly where the device hit this (#2109). So the check
    # runs for the GUI too; only the read-only actions are exempt, since
    # --status / --stop / --uninstall must keep working on a broken
    # install.
    read_only = ("--status", "--stop", "--uninstall", "--check")
    problem = (
        None
        if any(arg in read_only for arg in args)
        else _deployment_readiness_problem(config_file=Path(args[args.index("--config") + 1]))
    )
    if problem is not None:
        for line in problem:
            print(line, file=sys.stderr)
        return 5
    return _package_main(args)


if __name__ == "__main__":
    raise SystemExit(main())
