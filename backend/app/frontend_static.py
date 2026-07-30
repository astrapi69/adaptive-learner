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

import base64
import hashlib
import logging
import re
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)


class SPAStaticFiles(StaticFiles):
    """Static files with the SPA fallback nginx's ``try_files`` provided.

    A path that resolves to no real file (a client-side route like
    ``/content/set/:id`` from a share link, or ``/add-repo`` from a QR
    code) serves ``index.html`` so the router takes over after hydration.
    Real assets and existing files are served as themselves. API routes
    are registered BEFORE this mount and are never affected (#2058).
    """

    async def get_response(self, path: str, scope):  # type: ignore[override]
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code == 404 and not (path == "api" or path.startswith("api/")):
                return await super().get_response("index.html", scope)
            raise


class BodySizeLimitMiddleware:
    """Reject oversized request bodies with 413 (#2058).

    nginx enforced ``client_max_body_size 50M`` in front of the API; the
    single-container mode keeps that parity here. The check covers the
    declared ``Content-Length`` and, as a backstop, counts streamed chunks
    for chunked uploads without a length header.
    """

    def __init__(self, app: ASGIApp, max_bytes: int = 50 * 1024 * 1024) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {
            k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])
        }
        declared = headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
            await self._reject(scope, receive, send)
            return
        received = 0
        rejected = False

        async def counting_receive():
            nonlocal received, rejected
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    rejected = True
            return message

        try:
            await self.app(scope, counting_receive, send)
        finally:
            if rejected:
                logger.warning("Request body exceeded %d bytes (chunked)", self.max_bytes)

    async def _reject(self, scope: Scope, receive: Receive, send: Send) -> None:
        response = JSONResponse(
            status_code=413,
            content={
                "detail": f"Request body exceeds the {self.max_bytes // (1024 * 1024)} MB limit."
            },
        )
        await response(scope, receive, send)


def default_dist_dir() -> Path:
    """Resolve ``frontend/dist`` relative to this package (repo root).

    ``backend/app/frontend_static.py`` -> ``parents[2]`` is the repo root, so
    the built frontend lives at ``<repo>/frontend/dist``. An explicit override
    is available via ``ADAPTIVE_LEARNER_FRONTEND_DIST`` (read by the caller).
    """
    return Path(__file__).resolve().parents[2] / "frontend" / "dist"


_INLINE_SCRIPT_RE = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S)


def spa_csp_for(index_html: str) -> str:
    """Same-origin CSP for the served SPA, inline scripts allowed by HASH.

    Computed from the REAL ``index.html`` at mount time (#2197): the two
    inline blocks Vite ships (the FOUC-critical theme init and the
    Schema.org JSON-LD) are allowed via their sha256 hashes, so a changed
    snippet re-hashes itself on the next start instead of silently
    breaking - and ``script-src`` never needs ``unsafe-inline``.
    ``style-src`` keeps ``unsafe-inline`` for React/Recharts style
    attributes; blob/data cover the PWA worker, audio and images.
    """
    hashes = " ".join(
        "'sha256-" + base64.b64encode(hashlib.sha256(m.group(1).encode()).digest()).decode() + "'"
        for m in _INLINE_SCRIPT_RE.finditer(index_html)
    )
    script_src = f"script-src 'self' {hashes}".rstrip()
    return (
        "default-src 'self'; "
        f"{script_src}; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "media-src 'self' blob: data:; "
        "worker-src 'self' blob:; "
        "manifest-src 'self'; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )


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
    # ``html=True`` serves index.html for ``/`` (the SPA entry point);
    # :class:`SPAStaticFiles` adds the deep-route fallback nginx's
    # ``try_files`` used to provide. Mounted last, so API + plugin routes
    # registered earlier take precedence.
    app.mount("/", SPAStaticFiles(directory=str(target), html=True), name="frontend")
    # The security-headers middleware serves this to every non-API path
    # once set; without it the SPA shipped the deny-everything API CSP
    # and rendered a white page (#2197).
    app.state.spa_csp = spa_csp_for((target / "index.html").read_text(encoding="utf-8"))
    logger.info("Serving built frontend from %s at / (single-origin LAN mode)", target)
    return True
