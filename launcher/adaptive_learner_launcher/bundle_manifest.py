"""Runtime bundle-asset manifest for the frozen launcher (#2054).

ONE source of truth consumed by BOTH sides of the frozen contract:

- ``adaptive-learner-launcher.spec`` builds its ``datas`` from
  :data:`BUNDLE_ASSETS`, so an asset cannot be bundled without being
  checkable;
- the wrapper's start-up self-check and ``--verify-bundle`` flag assert
  every entry exists under ``sys._MEIPASS``, so a missing asset fails
  loudly with the COMPLETE gap list (#32 philosophy) instead of
  surfacing one path at a time on a device.

``docker-compose.prod.yml`` is deliberately NOT bundled: its build
contexts (``context: .``, ``backend/Dockerfile``, ``./frontend``) need
the whole source tree, which the wrapper provisions at runtime instead
(see ``__main__._bootstrap_app_source``).
"""

from __future__ import annotations

from pathlib import Path
from typing import NamedTuple


class BundleAsset(NamedTuple):
    """One bundled file: spec source path -> bundle destination."""

    source: str
    """Path relative to the ``launcher/`` directory (spec build CWD)."""

    dest_dir: str
    """Destination directory inside the bundle ("." = bundle root)."""

    bundle_path: str
    """Path of the file relative to the bundle root at runtime."""


BUNDLE_ASSETS: tuple[BundleAsset, ...] = (
    # The launcher config: __main__._config_path() reads it from the
    # bundle root when frozen (#2027).
    BundleAsset("launcher.json", ".", "launcher.json"),
    # Window icon (resolved best-effort at runtime; never fatal if absent).
    BundleAsset("adaptive-learner.png", ".", "adaptive-learner.png"),
    # The window icon at launcher.json's config-relative icon_path (#2027).
    BundleAsset(
        "../frontend/branding/adaptive-learner-mark.png",
        "frontend/branding",
        "frontend/branding/adaptive-learner-mark.png",
    ),
)

# Directories that must exist non-empty in the bundle. The i18n catalogs
# arrive via collect_data_files("docker_app_launcher") in the spec; the
# self-check pins their presence (the upstream #34 failure class).
BUNDLE_DIRS: tuple[str, ...] = ("docker_app_launcher/i18n",)


def spec_datas() -> list[tuple[str, str]]:
    """The ``datas`` entries for the PyInstaller spec, from the manifest."""
    return [(asset.source, asset.dest_dir) for asset in BUNDLE_ASSETS]


def missing_assets(root: Path) -> list[str]:
    """Every manifest entry absent under ``root`` (empty list = complete)."""
    missing: list[str] = []
    for asset in BUNDLE_ASSETS:
        if not (root / asset.bundle_path).is_file():
            missing.append(asset.bundle_path)
    for directory in BUNDLE_DIRS:
        path = root / directory
        if not path.is_dir() or not any(path.iterdir()):
            missing.append(directory)
    return missing
