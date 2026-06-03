"""Tests for the API rate-limiting middleware (token bucket).

Two layers:
  - Pure unit tests on ``RateLimiter`` / ``classify_tier`` with an
    injected clock (deterministic threshold + reset, no sleeping).
  - Integration tests on a tiny isolated FastAPI app wired with
    ``RateLimitMiddleware`` + a low-limit limiter, so the 429 response,
    its headers, and the exemption path are exercised end to end. The
    real app keeps rate limiting OFF in test mode, so the rest of the
    suite is unaffected.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.rate_limit import (
    RateLimiter,
    RateLimitMiddleware,
    TierConfig,
    classify_tier,
    load_rate_limit_config,
)


class _Clock:
    """A hand-cranked monotonic clock for deterministic refill tests."""

    def __init__(self, start: float = 1000.0) -> None:
        self.value = start

    def __call__(self) -> float:
        return self.value

    def advance(self, seconds: float) -> None:
        self.value += seconds


# --------------------------------------------------------------------------
# Unit — RateLimiter
# --------------------------------------------------------------------------


def test_rate_limit_blocks_after_threshold():
    """30 requests pass; the 31st is blocked (per-minute = 30)."""
    clock = _Clock()
    limiter = RateLimiter({"ai": TierConfig("ai", per_minute=30)}, now=clock, wall_now=clock)
    for i in range(30):
        assert limiter.check("1.2.3.4", "ai").allowed, f"request {i + 1} blocked"
    blocked = limiter.check("1.2.3.4", "ai")
    assert not blocked.allowed
    assert blocked.remaining == 0
    assert blocked.retry_after >= 1


def test_rate_limit_resets_after_window():
    """After the window elapses, tokens refill and requests pass again."""
    clock = _Clock()
    limiter = RateLimiter({"ai": TierConfig("ai", per_minute=30)}, now=clock, wall_now=clock)
    for _ in range(30):
        limiter.check("1.2.3.4", "ai")
    assert not limiter.check("1.2.3.4", "ai").allowed

    clock.advance(60)  # a full minute refills the bucket to capacity
    assert limiter.check("1.2.3.4", "ai").allowed


def test_rate_limit_per_endpoint_tier():
    """Tiers are independent and classify by path; AI != content."""
    # Classification maps the right paths to the right tiers.
    assert classify_tier("/api/plugins/session/abc/message", "POST") == "ai"
    assert classify_tier("/api/imports/abc/analyze", "POST") == "ai"
    assert classify_tier("/api/plugins/content-loader/sets", "GET") == "content"
    assert classify_tier("/api/settings/u1/api-key", "POST") == "settings"
    assert classify_tier("/api/health", "GET") is None
    assert classify_tier("/api/users", "GET") is None

    # A client at its AI limit can still use the (separate) content tier.
    clock = _Clock()
    limiter = RateLimiter(
        {
            "ai": TierConfig("ai", per_minute=1),
            "content": TierConfig("content", per_minute=5),
        },
        now=clock,
        wall_now=clock,
    )
    assert limiter.check("9.9.9.9", "ai").allowed
    assert not limiter.check("9.9.9.9", "ai").allowed  # ai exhausted
    assert limiter.check("9.9.9.9", "content").allowed  # content independent


def test_rate_limit_burst_ceiling():
    """A per-second burst ceiling blocks a rapid spike even when the
    per-minute budget still has room."""
    clock = _Clock()
    limiter = RateLimiter(
        {"ai": TierConfig("ai", per_minute=30, burst=5)}, now=clock, wall_now=clock
    )
    # Same instant -> only the burst capacity (5) gets through.
    allowed = sum(limiter.check("5.5.5.5", "ai").allowed for _ in range(10))
    assert allowed == 5
    # One second later the burst bucket refills.
    clock.advance(1)
    assert limiter.check("5.5.5.5", "ai").allowed


def test_rate_limit_decision_headers_math():
    """The decision carries a correct limit / remaining / reset / retry."""
    clock = _Clock()
    limiter = RateLimiter({"ai": TierConfig("ai", per_minute=10)}, now=clock, wall_now=clock)
    first = limiter.check("2.2.2.2", "ai")
    assert first.limit == 10
    assert first.remaining == 9
    assert first.reset_epoch >= int(clock())
    assert first.retry_after == 0  # allowed


def test_load_rate_limit_config_env_override(monkeypatch):
    """Env vars override the YAML / defaults for a tier."""
    monkeypatch.setenv("RATE_LIMIT_AI_PER_MINUTE", "99")
    monkeypatch.setenv("RATE_LIMIT_AI_BURST", "7")
    tiers = load_rate_limit_config()
    assert tiers["ai"].per_minute == 99
    assert tiers["ai"].burst == 7
    # Untouched tiers keep their configured/default values.
    assert tiers["content"].per_minute >= 1


# --------------------------------------------------------------------------
# Integration — middleware on a tiny isolated app
# --------------------------------------------------------------------------


def _build_app(*, per_minute: int, exempt: frozenset[str] = frozenset()) -> FastAPI:
    app = FastAPI()
    app.state.rate_limiter = RateLimiter({"ai": TierConfig("ai", per_minute=per_minute)})
    app.state.rate_limit_enabled = True
    app.state.rate_limit_exempt = exempt
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/plugins/session/{sid}/message")
    async def _message(sid: str):  # noqa: ANN202
        return {"ok": True}

    @app.get("/api/health")
    async def _health():  # noqa: ANN202
        return {"status": "ok"}

    return app


def test_rate_limit_integration_blocks_after_threshold():
    client = TestClient(_build_app(per_minute=3))
    for _ in range(3):
        assert client.post("/api/plugins/session/s/message").status_code == 200
    assert client.post("/api/plugins/session/s/message").status_code == 429


def test_rate_limit_headers_present():
    client = TestClient(_build_app(per_minute=2))
    ok = client.post("/api/plugins/session/s/message")
    assert ok.status_code == 200
    assert ok.headers["X-RateLimit-Limit"] == "2"
    assert "X-RateLimit-Remaining" in ok.headers
    assert "X-RateLimit-Reset" in ok.headers

    client.post("/api/plugins/session/s/message")  # consume the 2nd token
    blocked = client.post("/api/plugins/session/s/message")
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1
    assert blocked.headers["X-RateLimit-Remaining"] == "0"
    assert "X-RateLimit-Reset" in blocked.headers


def test_rate_limit_returns_friendly_message():
    client = TestClient(_build_app(per_minute=1))
    client.post("/api/plugins/session/s/message")
    blocked = client.post("/api/plugins/session/s/message")
    assert blocked.status_code == 429
    assert blocked.headers["content-type"].startswith("application/json")
    body = blocked.json()
    assert "detail" in body
    assert "Rate limit exceeded" in body["detail"]
    assert "<html" not in body["detail"].lower()


def test_rate_limit_exempt_localhost():
    # An exempt client IP is never limited, even past the threshold.
    client = TestClient(_build_app(per_minute=1, exempt=frozenset({"testclient"})))
    for _ in range(5):
        assert client.post("/api/plugins/session/s/message").status_code == 200


def test_rate_limit_unlimited_path_never_limited():
    client = TestClient(_build_app(per_minute=1))
    for _ in range(5):
        assert client.get("/api/health").status_code == 200
