"""Single-origin static frontend mount for the LAN device-test flow.

Pins:
- ``mount_frontend_static`` mounts the built ``dist`` at ``/`` so ``/``
  serves index.html, WITHOUT swallowing API routes registered earlier
  (the catch-all is the fallback, ``/api/...`` still returns JSON).
- A missing ``dist`` is a no-op (returns False), so the gate fails open.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.frontend_static import mount_frontend_static


def _app_with_api() -> FastAPI:
    app = FastAPI()

    @app.get("/api/ping")
    def _ping() -> dict[str, str]:
        return {"pong": "ok"}

    return app


def test_mount_serves_index_and_preserves_api(tmp_path: Path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>AL</title>", encoding="utf-8")

    app = _app_with_api()
    mounted = mount_frontend_static(app, dist)
    assert mounted is True

    client = TestClient(app)

    # API route still returns JSON (not swallowed by the ``/`` catch-all,
    # which is mounted AFTER it).
    resp = client.get("/api/ping")
    assert resp.status_code == 200
    assert resp.json() == {"pong": "ok"}

    # ``/`` serves the built index.html.
    root = client.get("/")
    assert root.status_code == 200
    assert "<title>AL</title>" in root.text


def test_mount_is_noop_without_dist(tmp_path: Path):
    app = _app_with_api()
    mounted = mount_frontend_static(app, tmp_path / "does-not-exist")
    assert mounted is False
    # API still works; no static mount added.
    client = TestClient(app)
    assert client.get("/api/ping").json() == {"pong": "ok"}
    assert client.get("/").status_code == 404
