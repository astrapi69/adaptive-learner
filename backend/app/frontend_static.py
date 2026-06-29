"""Single-origin static frontend serving for the LAN device-test flow.

The default dev flow (``make dev``) runs the Vite dev server and the API on
separate ports, so the backend never serves the frontend. For on-device
testing in the LAN (``make dev-lan``) it is far simpler to serve the BUILT
frontend (``frontend/dist``) AND the API from a single origin on the
backend port: no second server, no CORS hop, one URL to open in mobile
Safari.

This module mounts the built ``dist`` as a catch-all at ``/`` ONLY when the
caller asks for it (the lifespan gates the call on the
``ADAPTIVE_LEARNER_SERVE_FRONTEND`` env var). The mount is added AFTER every
API + plugin route so ``/api/...`` always wins; the static mount is the
fallback for everything else. ``make dev``, the backend test suite, and the
Docker/nginx production path are untouched (they never set the flag).
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger(__name__)


def default_dist_dir() -> Path:
    """Resolve ``frontend/dist`` relative to this package (repo root).

    ``backend/app/frontend_static.py`` -> ``parents[2]`` is the repo root, so
    the built frontend lives at ``<repo>/frontend/dist``. An explicit override
    is available via ``ADAPTIVE_LEARNER_FRONTEND_DIST`` (read by the caller).
    """
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


def mount_frontend_static(app: FastAPI, dist_dir: Path | None = None) -> bool:
    """Mount the built frontend at ``/`` as a catch-all, if it exists.

    Must be called AFTER all API + plugin routes are registered so the
    ``Mount("/")`` is the last route and never shadows ``/api/...``.

    Args:
        app: The FastAPI application.
        dist_dir: The built frontend directory. Defaults to
            :func:`default_dist_dir`.

    Returns:
        ``True`` when the mount was added, ``False`` when ``dist_dir`` (or its
        ``index.html``) is missing, so the caller can log a hint instead of
        failing.
    """
    target = dist_dir or default_dist_dir()
    if not (target / "index.html").is_file():
        logger.warning(
            "Frontend dist not found at %s; serving API only. Run `make build-frontend`.",
            target,
        )
        return False
    # ``html=True`` serves index.html for ``/`` (the SPA entry point). Mounted
    # last, so API + plugin routes registered earlier take precedence.
    app.mount("/", StaticFiles(directory=str(target), html=True), name="frontend")
    logger.info("Serving built frontend from %s at / (single-origin LAN mode)", target)
    return True
