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


def test_spa_fallback_serves_index_for_client_routes(tmp_path: Path):
    """#2058: a deep client route (share link, /add-repo QR) must render the
    SPA shell, exactly like nginx's ``try_files ... /index.html`` did."""
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>AL</title>", encoding="utf-8")
    (dist / "app.js").write_text("console.log(1)", encoding="utf-8")

    app = _app_with_api()
    assert mount_frontend_static(app, dist) is True
    client = TestClient(app)

    for route in ("/dashboard", "/content/set/abc-123", "/add-repo"):
        resp = client.get(route)
        assert resp.status_code == 200, route
        assert "<title>AL</title>" in resp.text, route

    # Real assets keep being served as themselves.
    asset = client.get("/app.js")
    assert asset.status_code == 200
    assert "console.log" in asset.text


def test_api_404_stays_json_not_spa(tmp_path: Path):
    """An unknown API path must stay a JSON 404 - never the SPA shell."""
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<!doctype html><title>AL</title>", encoding="utf-8")

    app = _app_with_api()
    mount_frontend_static(app, dist)
    client = TestClient(app)
    resp = client.get("/api/does-not-exist")
    assert resp.status_code == 404
    assert "<title>" not in resp.text


def test_body_limit_middleware_rejects_oversize(tmp_path: Path):
    """#2058: nginx enforced client_max_body_size 50M; the single-container
    mode keeps the parity via middleware -> 413 (PayloadTooLargeError shape)."""
    from app.frontend_static import BodySizeLimitMiddleware

    app = _app_with_api()

    @app.post("/api/echo")
    async def _echo() -> dict[str, str]:  # pragma: no cover - never reached oversize
        return {"ok": "yes"}

    app.add_middleware(BodySizeLimitMiddleware, max_bytes=1024)
    client = TestClient(app)

    ok = client.post("/api/echo", content=b"x" * 10, headers={"content-type": "text/plain"})
    assert ok.status_code == 200

    too_big = client.post("/api/echo", content=b"x" * 2048, headers={"content-type": "text/plain"})
    assert too_big.status_code == 413
