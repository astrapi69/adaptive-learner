"""In-memory pairing token store (Phase 13A).

A pairing token is a short-lived (5 min) one-time-use secret that
connects two devices on the same local network for sync. The
desktop generates one (carrying its own user_id) and displays it
inside a QR code; the phone verifies it via
``POST /api/sync/pair/verify`` and learns the user_id it should
adopt.

Process-memory storage is intentional: tokens are ephemeral,
single-process, and need no persistence beyond the live FastAPI
worker. A restart invalidates outstanding tokens — that's the
expected behaviour (forces the user to re-pair after a backend
restart, which is a tiny price).

If a future deployment scales to multiple workers, swap the
backing store for Redis without changing the public functions.
"""

from __future__ import annotations

import secrets
import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

# 5-minute TTL per the project spec. Long enough to scan / type
# in, short enough that a leaked token has near-zero residual
# value.
_TOKEN_TTL = timedelta(minutes=5)


@dataclass
class PairingToken:
    """One unconsumed pairing token.

    Fields are intentionally narrow: the only secret is the
    ``token`` string. ``user_id`` is needed so the verify
    endpoint can hand the right user back to the phone.
    """

    token: str
    user_id: str
    user_name: str
    created_at: datetime
    expires_at: datetime
    used: bool = False


_lock = threading.Lock()
_store: dict[str, PairingToken] = {}


def _now() -> datetime:
    return datetime.now(UTC)


def generate_token(user_id: str, user_name: str) -> PairingToken:
    """Mint a new one-time pairing token for the given user.

    The desktop calls this when the user clicks "Pair device".
    The token is 32 hex chars (128 bits of entropy) — short enough
    to type in as a fallback but long enough to resist guessing
    on a local network.
    """
    _purge_expired_locked_unsafe()
    token = secrets.token_hex(16)
    now = _now()
    pairing = PairingToken(
        token=token,
        user_id=user_id,
        user_name=user_name,
        created_at=now,
        expires_at=now + _TOKEN_TTL,
    )
    with _lock:
        _store[token] = pairing
    return pairing


def verify_token(token: str) -> PairingToken | None:
    """Consume the token. Returns the metadata on success, ``None``
    on miss, expiry, or replay.

    "Consume" means the token is marked ``used=True`` and removed
    from the store; a second verify call returns ``None``. The
    one-time-use property is the security floor — even if a token
    leaks AFTER the legitimate phone used it, the leaker cannot
    pair.
    """
    with _lock:
        _purge_expired_locked()
        existing = _store.get(token)
        if existing is None:
            return None
        if existing.used or _now() >= existing.expires_at:
            _store.pop(token, None)
            return None
        existing.used = True
        _store.pop(token, None)
        return existing


def peek_token(token: str) -> PairingToken | None:
    """Look up a token without consuming it. Returns None on
    miss/expiry. Test-only — production code uses
    :func:`verify_token`."""
    with _lock:
        _purge_expired_locked()
        existing = _store.get(token)
        if existing is None or _now() >= existing.expires_at:
            return None
        return existing


def _purge_expired_locked() -> None:
    """Drop expired tokens. Caller holds ``_lock``."""
    now = _now()
    expired = [k for k, v in _store.items() if now >= v.expires_at]
    for k in expired:
        _store.pop(k, None)


def _purge_expired_locked_unsafe() -> None:
    """Same as :func:`_purge_expired_locked` but acquires the
    lock itself. Used by entry points that don't hold it yet."""
    with _lock:
        _purge_expired_locked()


def _reset_for_tests() -> None:
    with _lock:
        _store.clear()


__all__ = [
    "PairingToken",
    "_reset_for_tests",
    "generate_token",
    "peek_token",
    "verify_token",
]
