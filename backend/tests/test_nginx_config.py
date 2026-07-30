"""Regression pin for the request-body limit (#994, relocated by #2058).

The limit used to live in ``frontend/nginx.conf.template``
(``client_max_body_size 50M``); the single-container consolidation
(#2058) retired the nginx service and moved the enforcement into
``BodySizeLimitMiddleware``. This pins BOTH halves so the limit cannot
silently regress: the middleware is wired in ``app.main`` with at least
50M, and the retired template stays gone (a resurrected template would
mean two competing limits again).
"""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MAIN_PY = REPO_ROOT / "backend" / "app" / "main.py"
RETIRED_NGINX_CONF = REPO_ROOT / "frontend" / "nginx.conf.template"

MIN_BYTES = 50 * 1024 * 1024


def test_body_limit_middleware_wired_with_at_least_50m() -> None:
    text = MAIN_PY.read_text(encoding="utf-8")
    match = re.search(
        r"add_middleware\(\s*BodySizeLimitMiddleware\s*,\s*max_bytes=([0-9*\s]+)\)", text
    )
    assert match, "BodySizeLimitMiddleware must be wired in app.main (#2058)"
    max_bytes = eval(match.group(1))  # noqa: S307 - arithmetic literal from our own source
    assert max_bytes >= MIN_BYTES, f"body limit regressed below 50M: {max_bytes}"


def test_retired_nginx_template_stays_gone() -> None:
    assert not RETIRED_NGINX_CONF.exists(), (
        "frontend/nginx.conf.template returned - the body limit lives in "
        "BodySizeLimitMiddleware since #2058; two competing limits invite drift"
    )
