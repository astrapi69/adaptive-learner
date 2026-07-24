"""Thin wrapper around the OpenAI SDK.

Kept separate from :mod:`.plugin` so:

- The wrapper is unit-testable in isolation (mock
  ``adaptive_learner_ai_openai.client.openai``).
- The plugin's ``ai_complete`` hookimpl only has to do the routing
  (gpt-prefix check, exception wrapping).

OpenAI accepts standard {role, content} message format with
``system`` / ``user`` / ``assistant`` roles inline — no
provider-specific transform is needed. The wrapper filters any
unknown role (``tool``, etc.) defensively to keep the SDK from
raising on input the orchestrator might one day produce.
"""

from __future__ import annotations

from typing import Any

# Top-level import so tests can patch the bound name on this
# module (``patch("adaptive_learner_ai_openai.client.openai")``).
# A lazy import inside ``complete()`` would silently re-import the
# real package on every call and bypass the mock — same trap the
# ai-anthropic client documents.
import openai

DEFAULT_MAX_TOKENS = 2048

_ACCEPTED_ROLES: frozenset[str] = frozenset({"system", "user", "assistant"})


def _filter_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only messages with a known role + string content.

    The orchestration layer in the session plugin should already
    only emit these three roles, but the SDK rejects anything
    outside that set — the filter is belt-and-braces.
    """
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
    """Call ``client.chat.completions.create`` and return the
    assistant text.

    Raises the SDK's native exceptions (``openai.AuthenticationError``,
    ``openai.APIConnectionError``, etc.). The plugin layer wraps
    these into typed :class:`app.exceptions.ExternalServiceError`
    so the FastAPI response stays consistent with the rest of the
    surface.
    """
    filtered = _filter_messages(messages)
    client = openai.OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        messages=filtered,
        max_tokens=max_tokens,
    )
    # ``response.choices`` is a non-empty list under normal
    # operation; ``choices[0].message.content`` carries the
    # assistant text. Be defensive against an empty list or a
    # missing content field (which can happen when the model hits
    # a finish_reason='content_filter' edge case).
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
    """v1.6.0 / Phase 19 - yield text deltas as OpenAI streams them.

    Uses ``AsyncOpenAI.chat.completions.create(stream=True)``,
    which returns an async iterator of ``ChatCompletionChunk``
    objects. Each chunk's ``choices[0].delta.content`` is either
    a string (the next token group) or ``None`` (a role / tool /
    finish marker). The wrapper drops everything that isn't a
    non-empty string.

    Raises the SDK's native exceptions; the plugin's hookimpl
    wraps them as ``ExternalServiceError``.
    """
    filtered = _filter_messages(messages)
    async_client = openai.AsyncOpenAI(api_key=api_key)
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
