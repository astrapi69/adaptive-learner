"""In-memory token-bucket API rate limiting (per client IP, per tier).

AI endpoints (Anthropic / OpenAI / Gemini) burn real API credits; an
abusive or buggy client (a retry loop, a runaway script) could rack up
cost or exhaust quota. This middleware caps request rate per client IP
per endpoint *tier* and answers an over-limit request with HTTP 429 +
``Retry-After`` / ``X-RateLimit-*`` headers, never touching the handler.

Design notes
------------
- **No new dependency.** A small token bucket (capacity = per-minute
  limit, refill = limit / 60 per second) gives a smooth sliding limit;
  an optional second per-second bucket enforces a burst ceiling.
- **Pure + injectable clock.** ``RateLimiter`` takes ``now`` (monotonic,
  for refill math) and ``wall_now`` (for the ``X-RateLimit-Reset`` epoch)
  so the threshold / reset behaviour is unit-testable without sleeping.
- **Exemptions.** Localhost + any configured exempt IPs are never
  limited; test mode (``ADAPTIVE_LEARNER_TEST=1``) is exempt unless
  ``RATE_LIMIT_ENABLED=1`` forces it on (so the suite can exercise it).
- **Tiers only.** Only the three configured tiers are limited; every
  other route (CRUD, health, version, docs) passes through untouched.
"""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import yaml
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger(__name__)

# backend/ — config/rate_limits.yaml lives beside app.yaml.
_BASE_DIR = Path(__file__).resolve().parent.parent.parent
_DEFAULT_CONFIG_PATH = _BASE_DIR / "config" / "rate_limits.yaml"

# Tier defaults (used when the YAML is missing a tier or absent entirely).
_TIER_DEFAULTS: dict[str, tuple[int, int | None]] = {
    "ai": (30, 5),
    "content": (60, None),
    "settings": (20, None),
}

_DEFAULT_EXEMPT_IPS = frozenset({"127.0.0.1", "::1", "localhost"})


@dataclass(frozen=True)
class TierConfig:
    """A single rate-limit tier: a sustained per-minute cap and an
    optional per-second burst ceiling."""

    name: str
    per_minute: int
    burst: int | None = None


@dataclass
class RateLimitDecision:
    """Outcome of a single ``RateLimiter.check`` call."""

    allowed: bool
    limit: int
    remaining: int
    reset_epoch: int
    retry_after: int


@dataclass
class _Bucket:
    tokens: float
    last: float


class RateLimiter:
    """Token-bucket limiter keyed by ``(client_ip, tier)``.

    Thread-safe (a single lock guards the bucket maps); the per-request
    work is O(1). Idle buckets are purged opportunistically so memory
    stays bounded under churny client IPs.
    """

    _CLEANUP_EVERY = 500
    _IDLE_PURGE_SECONDS = 300.0

    def __init__(
        self,
        tiers: dict[str, TierConfig],
        *,
        now: Callable[[], float] | None = None,
        wall_now: Callable[[], float] | None = None,
    ) -> None:
        self._tiers = dict(tiers)
        self._minute: dict[tuple[str, str], _Bucket] = {}
        self._burst: dict[tuple[str, str], _Bucket] = {}
        self._last_seen: dict[tuple[str, str], float] = {}
        self._now = now or time.monotonic
        self._wall = wall_now or time.time
        self._lock = threading.Lock()
        self._checks = 0

    @property
    def tiers(self) -> dict[str, TierConfig]:
        return dict(self._tiers)

    def _refill(
        self,
        buckets: dict[tuple[str, str], _Bucket],
        key: tuple[str, str],
        capacity: float,
        rate: float,
        now: float,
    ) -> _Bucket:
        bucket = buckets.get(key)
        if bucket is None:
            bucket = _Bucket(tokens=float(capacity), last=now)
            buckets[key] = bucket
            return bucket
        elapsed = now - bucket.last
        if elapsed > 0:
            bucket.tokens = min(capacity, bucket.tokens + elapsed * rate)
            bucket.last = now
        return bucket

    def check(self, client_ip: str, tier_name: str) -> RateLimitDecision:
        """Consume one token for ``(client_ip, tier_name)`` and report
        the decision. Raises ``KeyError`` if the tier is unknown."""
        tier = self._tiers[tier_name]
        key = (client_ip, tier_name)
        with self._lock:
            now = self._now()
            cap_minute = float(tier.per_minute)
            rate_minute = tier.per_minute / 60.0 if tier.per_minute > 0 else 0.0
            minute = self._refill(self._minute, key, cap_minute, rate_minute, now)

            burst_bucket: _Bucket | None = None
            burst_ok = True
            if tier.burst:
                burst_bucket = self._refill(
                    self._burst, key, float(tier.burst), float(tier.burst), now
                )
                burst_ok = burst_bucket.tokens >= 1.0

            minute_ok = minute.tokens >= 1.0
            allowed = minute_ok and burst_ok

            retry_after = 0
            if allowed:
                minute.tokens -= 1.0
                if burst_bucket is not None:
                    burst_bucket.tokens -= 1.0
            else:
                waits: list[float] = []
                if not minute_ok and rate_minute > 0:
                    waits.append((1.0 - minute.tokens) / rate_minute)
                if burst_bucket is not None and not burst_ok and tier.burst:
                    waits.append((1.0 - burst_bucket.tokens) / float(tier.burst))
                retry_after = max(1, math.ceil(max(waits))) if waits else 1

            remaining = max(0, int(math.floor(minute.tokens)))
            reset_seconds = (cap_minute - minute.tokens) / rate_minute if rate_minute > 0 else 0.0
            reset_epoch = int(self._wall() + reset_seconds)

            self._last_seen[key] = now
            self._maybe_cleanup(now)

            return RateLimitDecision(
                allowed=allowed,
                limit=tier.per_minute,
                remaining=remaining,
                reset_epoch=reset_epoch,
                retry_after=retry_after,
            )

    def _maybe_cleanup(self, now: float) -> None:
        self._checks += 1
        if self._checks % self._CLEANUP_EVERY != 0:
            return
        stale = [
            key for key, seen in self._last_seen.items() if now - seen > self._IDLE_PURGE_SECONDS
        ]
        for key in stale:
            self._minute.pop(key, None)
            self._burst.pop(key, None)
            self._last_seen.pop(key, None)


# Paths that are NEVER limited (monitoring + docs + first paint).
_UNLIMITED_EXACT = frozenset({"/openapi.json", "/api/docs", "/api/redoc"})
_UNLIMITED_PREFIXES = ("/api/health", "/api/version", "/api/i18n")


def classify_tier(path: str, method: str) -> str | None:
    """Map a request path/method to a rate-limit tier, or ``None`` for
    an unlimited route. Pure + side-effect free (unit-testable)."""
    if path in _UNLIMITED_EXACT or path.startswith(_UNLIMITED_PREFIXES):
        return None

    # AI: credit-burning provider calls.
    if path.startswith("/api/ai/"):
        return "ai"
    if "/plugins/session/" in path and (path.endswith("/message") or "/message/stream" in path):
        return "ai"
    if path.endswith("/analyze"):
        return "ai"

    # Content browsing.
    if "/plugins/content-loader/" in path:
        return "content"

    # Settings + backup.
    if path.startswith("/api/settings") or path.startswith("/api/backup"):
        return "settings"

    return None


def _rate_limit_headers(decision: RateLimitDecision) -> dict[str, str]:
    headers = {
        "X-RateLimit-Limit": str(decision.limit),
        "X-RateLimit-Remaining": str(decision.remaining),
        "X-RateLimit-Reset": str(decision.reset_epoch),
    }
    if not decision.allowed:
        headers["Retry-After"] = str(decision.retry_after)
    return headers


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enforce per-IP, per-tier limits using the limiter on
    ``app.state.rate_limiter``.

    Reads its switches off ``app.state`` so tests can build a tiny
    isolated app with a low-limit limiter:
      - ``rate_limiter``         — a ``RateLimiter`` (or ``None`` -> off)
      - ``rate_limit_enabled``   — bool master switch
      - ``rate_limit_exempt``    — frozenset of exempt client IPs
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        state = request.app.state
        limiter: RateLimiter | None = getattr(state, "rate_limiter", None)
        if not getattr(state, "rate_limit_enabled", False) or limiter is None:
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        exempt = getattr(state, "rate_limit_exempt", _DEFAULT_EXEMPT_IPS)
        if client_ip in exempt:
            return await call_next(request)

        tier = classify_tier(request.url.path, request.method)
        if tier is None or tier not in limiter.tiers:
            return await call_next(request)

        decision = limiter.check(client_ip, tier)
        if not decision.allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": (f"Rate limit exceeded. Try again in {decision.retry_after} seconds.")
                },
                headers=_rate_limit_headers(decision),
            )

        response = await call_next(request)
        for key, value in _rate_limit_headers(decision).items():
            response.headers.setdefault(key, value)
        return response


def _env_int(name: str, fallback: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return fallback
    try:
        return int(raw)
    except ValueError:
        logger.warning("Ignoring non-integer %s=%r; using %d", name, raw, fallback)
        return fallback


def _env_burst(name: str, fallback: int | None) -> int | None:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return fallback
    try:
        return int(raw)
    except ValueError:
        logger.warning("Ignoring non-integer %s=%r; using %r", name, raw, fallback)
        return fallback


def load_rate_limit_config(
    config_path: Path | None = None,
) -> dict[str, TierConfig]:
    """Build the tier table from ``rate_limits.yaml`` + env overrides.

    YAML fills in the per-tier values; ``RATE_LIMIT_<TIER>_PER_MINUTE``
    / ``RATE_LIMIT_<TIER>_BURST`` env vars win over the file. Missing
    tiers fall back to the built-in defaults, so the limiter always has
    a complete, valid table even with no file.
    """
    path = config_path or _DEFAULT_CONFIG_PATH
    raw: dict = {}
    if path.exists():
        try:
            with path.open(encoding="utf-8") as handle:
                loaded = yaml.safe_load(handle) or {}
            raw = (loaded.get("rate_limits") or {}) if isinstance(loaded, dict) else {}
        except (yaml.YAMLError, OSError) as exc:
            logger.warning("Could not read %s: %s. Using rate-limit defaults.", path, exc)

    tiers: dict[str, TierConfig] = {}
    for name, (default_pm, default_burst) in _TIER_DEFAULTS.items():
        cfg = raw.get(name) or {}
        per_minute = _env_int(
            f"RATE_LIMIT_{name.upper()}_PER_MINUTE",
            int(cfg.get("per_minute", default_pm)),
        )
        burst = _env_burst(
            f"RATE_LIMIT_{name.upper()}_BURST",
            cfg.get("burst", default_burst),
        )
        tiers[name] = TierConfig(name=name, per_minute=per_minute, burst=burst)
    return tiers


def resolve_exempt_ips() -> frozenset[str]:
    """Localhost plus any comma-separated ``RATE_LIMIT_EXEMPT_IPS``."""
    extra = os.environ.get("RATE_LIMIT_EXEMPT_IPS", "")
    ips = {part.strip() for part in extra.split(",") if part.strip()}
    return _DEFAULT_EXEMPT_IPS | frozenset(ips)


def rate_limiting_enabled() -> bool:
    """Master switch. On by default; off in test mode unless
    ``RATE_LIMIT_ENABLED`` explicitly forces it (so the suite can test
    the limiter while the rest of the suite runs unthrottled)."""
    forced = os.environ.get("RATE_LIMIT_ENABLED", "").strip().lower()
    if forced in ("1", "true", "yes"):
        return True
    if forced in ("0", "false", "no"):
        return False
    return os.environ.get("ADAPTIVE_LEARNER_TEST") != "1"
