"""Live API-key test service (Phase 65).

Fires a single, minimal completion request (``max_tokens=1``) at the
provider and classifies the outcome. Used by
``POST /api/settings/{user_id}/test-api-key`` so the user can verify a
key works BEFORE relying on it — and by the revised save flow, which
auto-tests a new key and offers a rollback if it fails.

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

# Cheapest valid model per provider for a throwaway 1-token call.
# Mirrors the frontend DEFAULT_MODELS map.
_TEST_MODELS: dict[AIProvider, str] = {
    AIProvider.ANTHROPIC: "claude-haiku-4-5-20251001",
    AIProvider.OPENAI: "gpt-4o-mini",
    AIProvider.GEMINI: "gemini-2.0-flash",
}


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


def _post(url: str, *, headers: dict[str, str], json: dict) -> ApiKeyTestResult:
    try:
        response = httpx.post(url, headers=headers, json=json, timeout=_HTTP_TIMEOUT_SECONDS)
    except httpx.HTTPError:
        # Connect / read / timeout — the key may be fine; the network
        # isn't. Never raises: the caller renders a friendly warning.
        return ApiKeyTestResult(False, "network")
    return _classify(response.status_code)


def test_api_key(provider: AIProvider, key: str | None) -> ApiKeyTestResult:
    """Test ``key`` against ``provider`` with a minimal call. Returns a
    classified result; never raises."""
    if not key or not key.strip():
        return ApiKeyTestResult(False, "no_key")
    token = key.strip()
    model = _TEST_MODELS[provider]
    if provider == AIProvider.ANTHROPIC:
        return _post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": token,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "Hi"}],
            },
        )
    if provider == AIProvider.OPENAI:
        return _post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {token}",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "Hi"}],
            },
        )
    # Gemini: the key rides in the query string, no auth header.
    return _post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={token}",
        headers={"content-type": "application/json"},
        json={
            "contents": [{"role": "user", "parts": [{"text": "Hi"}]}],
            "generationConfig": {"maxOutputTokens": 1},
        },
    )
