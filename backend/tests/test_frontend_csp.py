"""The SPA must be allowed to load itself (#2197).

The security-headers middleware predates #2058 and knew two response
classes: API (deny-everything CSP) and Swagger docs. Since #2058 the
backend ALSO serves the built frontend - and shipped it with
``default-src 'none'``: a white page for every image-mode user, found
on the QA device the day v2.8.0 first reached one.

Three response classes, pinned separately: SPA (self + hashed inline
scripts, computed from the REAL index.html at mount time), API (strict,
unchanged), docs (unchanged). RED against the pre-fix middleware.
"""

from __future__ import annotations

import base64
import hashlib
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

INLINE = '(function(){document.documentElement.dataset.theme="dark";})()'
JSONLD = '{"@context":"https://schema.org"}'


def _hash(snippet: str) -> str:
    return "sha256-" + base64.b64encode(hashlib.sha256(snippet.encode()).digest()).decode()


@pytest.fixture()
def spa_app(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text(
        "<!doctype html><html><head>"
        f'<script type="application/ld+json">{JSONLD}</script>'
        f"<script>{INLINE}</script>"
        '</head><body><div id="root"></div></body></html>',
        encoding="utf-8",
    )
    (dist / "app.css").write_text("body{}", encoding="utf-8")
    from app import frontend_static
    from app.main import app

    assert frontend_static.mount_frontend_static(app, dist), "mount refused the fixture dist"
    try:
        yield app
    finally:
        # Unmount: drop the catch-all route + the stored CSP so other tests
        # keep seeing the API-only app.
        app.router.routes = [r for r in app.router.routes if getattr(r, "name", "") != "frontend"]
        if hasattr(app.state, "spa_csp"):
            del app.state.spa_csp


def test_spa_page_is_allowed_to_load_itself(spa_app) -> None:
    """RED repro of the white page: '/' carried default-src 'none'."""
    client = TestClient(spa_app)
    csp = client.get("/").headers["content-security-policy"]
    assert "default-src 'none'" not in csp, "the SPA ships its own kill switch"
    assert "default-src 'self'" in csp
    assert "manifest-src 'self'" in csp
    assert "worker-src 'self'" in csp
    # The app's own browser-side calls, each verified in source (#2197):
    assert "connect-src 'self' https://api.github.com https://raw.githubusercontent.com" in csp


def test_spa_images_come_only_from_the_app_and_its_content_host(spa_app) -> None:
    """No third-party image host (#3803): a YouTube resource card shows a
    local placeholder since #3803, so img.youtube.com left the policy. What
    stays is the app itself, embedded and object URLs (downloaded set assets
    render as blob: URLs) and the content repositories' raw host (book
    covers)."""
    client = TestClient(spa_app)
    csp = client.get("/").headers["content-security-policy"]
    assert "img-src 'self' data: blob: https://raw.githubusercontent.com;" in csp
    assert "img.youtube.com" not in csp


def _directives(policy: str) -> dict[str, set[str]]:
    """A CSP string as directive name -> set of sources."""
    parsed: dict[str, set[str]] = {}
    for part in policy.split(";"):
        name, *sources = part.split()
        parsed[name] = set(sources)
    return parsed


def test_pages_build_allows_the_same_image_and_media_sources_as_api_mode() -> None:
    """GitHub Pages sends no headers, so the Pages build carries img-src and
    media-src as a meta tag in frontend/index.html (#3803). Both builds must
    allow the same sources: a host added to one only would load in one
    mode and be refused in the other."""
    import re

    from app.frontend_static import spa_csp_for

    index_html = (Path(__file__).resolve().parents[2] / "frontend" / "index.html").read_text(
        encoding="utf-8"
    )
    match = re.search(
        r'<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"', index_html
    )
    assert match, "frontend/index.html carries no Content-Security-Policy meta tag"
    pages = _directives(match.group(1))
    api = _directives(spa_csp_for(index_html))
    for name in ("img-src", "media-src"):
        assert pages[name] == api[name], f"{name} differs between the Pages build and API mode"


def test_inline_scripts_are_hash_allowed_not_unsafe_inline(spa_app) -> None:
    """The theme-init + JSON-LD inline blocks pass by HASH - computed from
    the real index.html at mount time, so a changed snippet re-hashes
    itself instead of silently breaking or forcing unsafe-inline."""
    client = TestClient(spa_app)
    csp = client.get("/").headers["content-security-policy"]
    assert _hash(INLINE) in csp
    assert _hash(JSONLD) in csp
    assert "script-src 'self'" in csp
    assert "unsafe-inline" not in csp.split("style-src")[0], "scripts must not fall back to unsafe-inline"


def test_assets_get_the_spa_policy_too(spa_app) -> None:
    client = TestClient(spa_app)
    csp = client.get("/app.css").headers["content-security-policy"]
    assert "default-src 'self'" in csp


def test_api_keeps_the_strict_policy(spa_app) -> None:
    """The deny-everything CSP stays exactly right for JSON responses."""
    client = TestClient(spa_app)
    csp = client.get("/api/health").headers["content-security-policy"]
    assert "default-src 'none'" in csp


def test_without_a_mounted_frontend_everything_stays_strict() -> None:
    """The API-only deployments (make dev, tests, GH Pages) are untouched."""
    from app.main import app

    client = TestClient(app)
    csp = client.get("/api/health").headers["content-security-policy"]
    assert "default-src 'none'" in csp


class TestBareContainerDefaults:
    """#2198: the image is a public artifact; safe defaults live in the
    APP - wrappers may sharpen them, never repair them."""

    def test_debug_defaults_off(self) -> None:
        """DEBUG is a module-level constant read at import time, so the
        authoritative artifact-level pin is the SOURCE default at both
        read sites - the same string the bare container boots with."""
        import re
        from pathlib import Path

        import app.main as main_module

        source = Path(main_module.__file__).read_text(encoding="utf-8")
        match = re.search(r'ADAPTIVE_LEARNER_DEBUG",\s*"(\w+)"', source)
        assert match and match.group(1) == "false", "the bare artifact must not default to debug"
        logsrc = (Path(main_module.__file__).parent / "logging_config.py").read_text(encoding="utf-8")
        match2 = re.search(r'ADAPTIVE_LEARNER_DEBUG",\s*"(\w+)"', logsrc)
        assert match2 and match2.group(1) == "false"
