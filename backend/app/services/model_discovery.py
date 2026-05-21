"""Provider model-discovery service (v1.11.0 / Phase 24A).

Fetches the list of models the user actually has access to from
each provider's official models endpoint. Used by the Settings UI
to show a dropdown of real, available models instead of the
static suggestion list bundled in the frontend.

Caching:
  Results are cached per ``(provider, api_key_hash)`` for one
  hour. The hash keeps two distinct keys for the same provider
  isolated; the TTL stops the picker hammering the upstream API
  on every focus event. In-memory dict; no Redis, no DB.

Filtering:
  Only chat / text-completion models survive. Embedding,
  fine-tune, moderation, audio, and image models are dropped — a
  user cannot meaningfully pick them for ``ai_complete``.

Error semantics:
  - Missing api_key → empty list (the UI shows the manual-input
    fallback).
  - Unauthorised / forbidden → raises :class:`ExternalServiceError`
    so the router can render a precise toast.
  - Network / timeout → raises :class:`ExternalServiceError`
    with the same shape; the cache is consulted first so a brief
    upstream blip doesn't take the picker down.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.exceptions import ExternalServiceError, ValidationError
from app.schemas import AIProvider

# 1 hour TTL — picker freshness vs. upstream rate-limits.
_CACHE_TTL_SECONDS = 3600.0
# Connect + read timeout for every upstream call.
_HTTP_TIMEOUT_SECONDS = 5.0


@dataclass
class ModelInfo:
    """One row in the picker. ``id`` is the canonical model string
    the user picks; ``name`` is the human label; ``context_window``
    is the input-token cap (None for providers that don't expose
    it). ``description`` is a short tagline shown next to the
    name when present."""

    id: str
    name: str
    context_window: int | None = None
    description: str | None = None


@dataclass
class _CacheEntry:
    models: list[ModelInfo]
    expires_at: float = field(default=0.0)


_cache: dict[tuple[str, str], _CacheEntry] = {}


def _cache_key(provider: AIProvider, api_key: str) -> tuple[str, str]:
    # Hash the key so the cache can't leak it via repr / debug.
    digest = hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:16]
    return (provider.value, digest)


def _cache_get(provider: AIProvider, api_key: str) -> list[ModelInfo] | None:
    entry = _cache.get(_cache_key(provider, api_key))
    if entry is None:
        return None
    if entry.expires_at < time.time():
        # Stale; drop it so the next miss refetches.
        _cache.pop(_cache_key(provider, api_key), None)
        return None
    return list(entry.models)


def _cache_put(provider: AIProvider, api_key: str, models: list[ModelInfo]) -> None:
    _cache[_cache_key(provider, api_key)] = _CacheEntry(
        models=list(models),
        expires_at=time.time() + _CACHE_TTL_SECONDS,
    )


def clear_cache() -> None:
    """Drop every cached entry. Used by tests; safe to call at any time."""
    _cache.clear()


# --- Filtering --------------------------------------------------------------

# OpenAI model IDs that should NOT appear in the chat picker.
_OPENAI_EXCLUDE_SUBSTRINGS = (
    "embedding",
    "whisper",
    "tts",
    "dall-e",
    "moderation",
    "search",
    "babbage",
    "davinci-002",
    "audio",
    "image",
    "transcribe",
    "realtime",
)

# Gemini model IDs to drop from the picker.
_GEMINI_EXCLUDE_SUBSTRINGS = (
    "embedding",
    "aqa",
    "vision",
)


def _is_chat_model_openai(model_id: str) -> bool:
    lowered = model_id.lower()
    if any(token in lowered for token in _OPENAI_EXCLUDE_SUBSTRINGS):
        return False
    # The chat models on OpenAI are gpt-* (and the o1/o3 reasoning
    # series). Everything else is either an embedding, an audio
    # model, or a deprecated completion model.
    if lowered.startswith("gpt-") or lowered.startswith("o1") or lowered.startswith("o3"):
        return True
    return False


def _is_chat_model_gemini(model: dict[str, Any]) -> bool:
    name = str(model.get("name") or "").lower()
    if any(token in name for token in _GEMINI_EXCLUDE_SUBSTRINGS):
        return False
    methods = model.get("supportedGenerationMethods") or []
    # Only models that can do generateContent / streamGenerateContent
    # are usable in our ai_complete path.
    return "generateContent" in methods


# --- Anthropic --------------------------------------------------------------


def fetch_anthropic_models(api_key: str) -> list[ModelInfo]:
    """Call ``GET /v1/models`` on the Anthropic API."""
    if not api_key:
        return []
    cached = _cache_get(AIProvider.ANTHROPIC, api_key)
    if cached is not None:
        return cached
    try:
        response = httpx.get(
            "https://api.anthropic.com/v1/models",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise ExternalServiceError("anthropic", f"Network error: {exc}") from exc
    if response.status_code == 401 or response.status_code == 403:
        raise ExternalServiceError("anthropic", "Invalid API key.")
    if not response.is_success:
        raise ExternalServiceError("anthropic", f"HTTP {response.status_code}")
    payload = response.json()
    raw_models = payload.get("data") or []
    models: list[ModelInfo] = []
    for entry in raw_models:
        model_id = entry.get("id")
        if not isinstance(model_id, str) or not model_id:
            continue
        display_name = entry.get("display_name") or model_id
        models.append(
            ModelInfo(
                id=model_id,
                name=str(display_name),
                context_window=200000,
                description=None,
            )
        )
    _cache_put(AIProvider.ANTHROPIC, api_key, models)
    return list(models)


# --- OpenAI ----------------------------------------------------------------


def fetch_openai_models(api_key: str) -> list[ModelInfo]:
    """Call ``GET /v1/models`` on the OpenAI API."""
    if not api_key:
        return []
    cached = _cache_get(AIProvider.OPENAI, api_key)
    if cached is not None:
        return cached
    try:
        response = httpx.get(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise ExternalServiceError("openai", f"Network error: {exc}") from exc
    if response.status_code == 401 or response.status_code == 403:
        raise ExternalServiceError("openai", "Invalid API key.")
    if not response.is_success:
        raise ExternalServiceError("openai", f"HTTP {response.status_code}")
    payload = response.json()
    raw_models = payload.get("data") or []
    models: list[ModelInfo] = []
    for entry in raw_models:
        model_id = entry.get("id")
        if not isinstance(model_id, str) or not model_id:
            continue
        if not _is_chat_model_openai(model_id):
            continue
        models.append(
            ModelInfo(
                id=model_id,
                name=_humanize_openai_name(model_id),
                context_window=_openai_context_window(model_id),
                description=None,
            )
        )
    # OpenAI returns a soup; sort newest-looking first so the
    # picker top has the user's most likely pick.
    models.sort(key=lambda m: m.id, reverse=True)
    _cache_put(AIProvider.OPENAI, api_key, models)
    return list(models)


def _humanize_openai_name(model_id: str) -> str:
    # gpt-4o-mini → "GPT-4o mini", o1-preview → "o1 preview".
    pretty = model_id.replace("-", " ")
    if pretty.startswith("gpt "):
        pretty = "GPT-" + pretty[4:]
    return pretty


def _openai_context_window(model_id: str) -> int | None:
    # Rough mapping; OpenAI's /v1/models doesn't expose context
    # windows. Hard-coded for the visible families.
    lowered = model_id.lower()
    if "gpt-4o" in lowered or "gpt-4.1" in lowered:
        return 128000
    if "gpt-4-turbo" in lowered or lowered.startswith("gpt-4-1106") or lowered.startswith("gpt-4-0125"):
        return 128000
    if lowered.startswith("gpt-4"):
        return 8192
    if lowered.startswith("gpt-3.5"):
        return 16384
    if lowered.startswith("o1") or lowered.startswith("o3"):
        return 200000
    return None


# --- Gemini ----------------------------------------------------------------


def fetch_gemini_models(api_key: str) -> list[ModelInfo]:
    """Call ``GET /v1beta/models`` on the Gemini API."""
    if not api_key:
        return []
    cached = _cache_get(AIProvider.GEMINI, api_key)
    if cached is not None:
        return cached
    try:
        response = httpx.get(
            "https://generativelanguage.googleapis.com/v1beta/models",
            params={"key": api_key},
            timeout=_HTTP_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        raise ExternalServiceError("gemini", f"Network error: {exc}") from exc
    if response.status_code == 401 or response.status_code == 403:
        raise ExternalServiceError("gemini", "Invalid API key.")
    if not response.is_success:
        raise ExternalServiceError("gemini", f"HTTP {response.status_code}")
    payload = response.json()
    raw_models = payload.get("models") or []
    models: list[ModelInfo] = []
    for entry in raw_models:
        if not _is_chat_model_gemini(entry):
            continue
        full_name = str(entry.get("name") or "")
        # Gemini IDs come as ``models/gemini-2.0-flash``; strip the
        # prefix so callers can pass the bare id back to
        # generateContent (which expects either form).
        model_id = full_name.removeprefix("models/")
        if not model_id:
            continue
        display = entry.get("displayName") or model_id
        context = entry.get("inputTokenLimit")
        description = entry.get("description") or None
        models.append(
            ModelInfo(
                id=model_id,
                name=str(display),
                context_window=int(context) if isinstance(context, int) else None,
                description=description,
            )
        )
    _cache_put(AIProvider.GEMINI, api_key, models)
    return list(models)


# --- Dispatch --------------------------------------------------------------


def fetch_models(provider: AIProvider, api_key: str) -> list[ModelInfo]:
    """Provider-agnostic dispatcher used by the router."""
    if provider == AIProvider.ANTHROPIC:
        return fetch_anthropic_models(api_key)
    if provider == AIProvider.OPENAI:
        return fetch_openai_models(api_key)
    if provider == AIProvider.GEMINI:
        return fetch_gemini_models(api_key)
    raise ValidationError(f"Unsupported AI provider: {provider!r}")


__all__ = [
    "ModelInfo",
    "clear_cache",
    "fetch_anthropic_models",
    "fetch_gemini_models",
    "fetch_models",
    "fetch_openai_models",
]
