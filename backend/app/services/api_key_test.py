"""Live API-key test service (Phase 65; probe reworked in #799).

Validates a caller-supplied key by calling the provider's lightweight
**models-list** endpoint (a ``GET`` that returns 200 when the key is
accepted and 401/403 when it is not) and classifies the HTTP status.
Used by ``POST /api/settings/{user_id}/test-api-key`` so the user can
verify a key works BEFORE relying on it.

Why models-list and not a generation call (#799): a 1-token
``generateContent`` / ``chat`` probe is the wrong test for key VALIDITY.
Gemini returns an empty completion under a 1-token cap (a false failure),
and OpenAI's generation path additionally depends on per-model access and
quota — none of which reflect whether the key itself is valid. The
models-list GET is the same probe ``model_discovery`` already uses, costs
no tokens, and is the canonical "is this key accepted" check.

Deliberately NOT routed through the ai_complete plugin hook: the hook
resolves the key from the env > secrets.yaml > DB chain, whereas this
service must test an ARBITRARY caller-supplied key (the one the user
just typed, not yet saved). It makes the provider HTTP call directly
with httpx (already a backend dependency, same pattern as
``model_discovery``).
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.schemas import AIProvider

# Generous timeout — a cold provider edge can take several seconds;
# the frontend shows a spinner and offers "save anyway" past this.
_HTTP_TIMEOUT_SECONDS = 10.0


@dataclass
class ApiKeyTestResult:
    """``kind`` is one of ok / invalid / rate_limit / network / error /
    no_key (see :class:`app.schemas.ApiKeyTestOut`)."""

    success: bool
    kind: str


def _classify(status_code: int) -> ApiKeyTestResult:
    if 200 <= status_code < 300:
        return ApiKeyTestResult(True, "ok")
    if status_code in (401, 403):
        return ApiKeyTestResult(False, "invalid")
    if status_code == 429:
        return ApiKeyTestResult(False, "rate_limit")
    return ApiKeyTestResult(False, "error")


def _get(url: str, *, headers: dict[str, str]) -> ApiKeyTestResult:
    try:
        response = httpx.get(url, headers=headers, timeout=_HTTP_TIMEOUT_SECONDS)
    except httpx.HTTPError:
        # Connect / read / timeout — the key may be fine; the network
        # isn't. Never raises: the caller renders a friendly warning.
        return ApiKeyTestResult(False, "network")
    return _classify(response.status_code)


def test_api_key(provider: AIProvider, key: str | None) -> ApiKeyTestResult:
    """Test ``key`` against ``provider`` via its models-list endpoint.
    Returns a classified result; never raises."""
    if not key or not key.strip():
        return ApiKeyTestResult(False, "no_key")
    token = key.strip()
    if provider == AIProvider.ANTHROPIC:
        return _get(
            "https://api.anthropic.com/v1/models",
            headers={
                "x-api-key": token,
                "anthropic-version": "2023-06-01",
            },
        )
    if provider == AIProvider.OPENAI:
        return _get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {token}"},
        )
    # Gemini: the key rides in the query string, no auth header.
    return _get(
        f"https://generativelanguage.googleapis.com/v1beta/models?key={token}",
        headers={},
    )
