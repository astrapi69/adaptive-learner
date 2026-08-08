"""Thin wrapper around the OpenAI SDK pointed at Perplexity.

Kept separate from :mod:`.plugin` so:

- The wrapper is unit-testable in isolation (mock
  ``adaptive_learner_ai_perplexity.client.openai``).
- The plugin's ``ai_complete`` hookimpl only has to do the routing
  (sonar-prefix check, exception wrapping).

Perplexity implements the OpenAI chat-completions wire format, so
the OpenAI SDK with ``base_url="https://api.perplexity.ai"`` is the
whole client - no provider-specific transform. The message filter
mirrors the ai-openai client: keep only known roles with string
content, defensively.
"""

from __future__ import annotations

from typing import Any

# Top-level import so tests can patch the bound name on this module
# (``patch("adaptive_learner_ai_perplexity.client.openai")``). A lazy
# import inside ``complete()`` would silently re-import the real
# package on every call and bypass the mock - same trap the
# ai-anthropic client documents.
import openai

PERPLEXITY_BASE_URL = "https://api.perplexity.ai"
DEFAULT_MAX_TOKENS = 2048

_ACCEPTED_ROLES: frozenset[str] = frozenset({"system", "user", "assistant"})


def _filter_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only messages with a known role + string content."""
    out: list[dict[str, Any]] = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content")
        if not isinstance(role, str) or role not in _ACCEPTED_ROLES:
            continue
        if not isinstance(content, str) or not content:
            continue
        out.append({"role": role, "content": content})
    return out


def complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> str:
    """Call Perplexity's ``chat/completions`` and return the
    assistant text.

    Raises the SDK's native exceptions (``openai.AuthenticationError``,
    ``openai.APIConnectionError``, etc.). The plugin layer wraps
    these into typed :class:`app.exceptions.ExternalServiceError`.
    """
    filtered = _filter_messages(messages)
    client = openai.OpenAI(api_key=api_key, base_url=PERPLEXITY_BASE_URL)
    response = client.chat.completions.create(
        model=model,
        messages=filtered,
        max_tokens=max_tokens,
    )
    choices = getattr(response, "choices", None) or []
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    if message is None:
        return ""
    content = getattr(message, "content", None)
    return content if isinstance(content, str) else ""


async def stream(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
):
    """Yield text deltas as Perplexity streams them.

    Uses ``AsyncOpenAI(base_url=...).chat.completions.create(stream=True)``;
    each chunk's ``choices[0].delta.content`` is either a string or
    ``None`` (role / finish markers). Drops everything that isn't a
    non-empty string. Raises the SDK's native exceptions; the
    hookimpl wraps them as ``ExternalServiceError``.
    """
    filtered = _filter_messages(messages)
    async_client = openai.AsyncOpenAI(api_key=api_key, base_url=PERPLEXITY_BASE_URL)
    response = await async_client.chat.completions.create(
        model=model,
        messages=filtered,
        max_tokens=max_tokens,
        stream=True,
    )
    async for chunk in response:
        choices = getattr(chunk, "choices", None) or []
        if not choices:
            continue
        delta = getattr(choices[0], "delta", None)
        if delta is None:
            continue
        content = getattr(delta, "content", None)
        if isinstance(content, str) and content:
            yield content
