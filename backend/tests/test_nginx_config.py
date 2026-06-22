"""Regression pin for the nginx request-body limit (#994).

The prod stack proxies the API through ``frontend/nginx.conf``. nginx
defaults ``client_max_body_size`` to 1M, which 413s any larger upload
(backup ``.alb`` import, content set-downloads, ...). This pins the
directive at >= 50M so the limit can't silently regress to the default.
"""

from __future__ import annotations

import re
from pathlib import Path

NGINX_CONF = Path(__file__).resolve().parents[2] / "frontend" / "nginx.conf"


def test_nginx_allows_large_request_bodies() -> None:
    text = NGINX_CONF.read_text(encoding="utf-8")
    match = re.search(r"client_max_body_size\s+(\d+)([KMG]?)\s*;", text, re.IGNORECASE)
    assert match, "client_max_body_size directive missing from nginx.conf (#994)"
    value, unit = int(match.group(1)), match.group(2).upper()
    megabytes = {"K": value / 1024, "M": value, "G": value * 1024, "": value / 1_000_000}[unit]
    assert megabytes >= 50, f"client_max_body_size too small ({value}{unit}); need >= 50M (#994)"
