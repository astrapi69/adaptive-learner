"""Thin wrapper around the Anthropic SDK.

Kept separate from :mod:`.plugin` so:

- The wrapper is unit-testable in isolation (mock ``anthropic.Anthropic``).
- The plugin's ``ai_complete`` hookimpl only has to do the routing
  (claude-prefix check, exception wrapping).

OpenAI-style chat messages (``role`` + ``content``) need a small
transform on the way out: Anthropic's ``messages.create`` takes
the system prompt as a top-level ``system`` kwarg, not as a role
inside the messages list. The wrapper collapses any number of
``role="system"`` entries into one newline-joined system prompt.
"""

from __future__ import annotations

from typing import Any

# Top-level import so tests can patch the bound name on this
# module (``patch("adaptive_learner_ai_anthropic.client.anthropic")``).
# A lazy import inside ``complete()`` would silently re-import the
# real package on every call and bypass the mock — the first cut
# of this module accidentally hit the real Anthropic API in CI
# until this was moved to module level.
import anthropic

DEFAULT_MAX_TOKENS = 2048


def _split_system_and_chat(
    messages: list[dict[str, Any]],
) -> tuple[str | None, list[dict[str, Any]]]:
    """Pop every ``role="system"`` entry into a single system string,
    leaving the user/assistant messages in original order.

    Anthropic's API rejects unknown roles outside the standard
    set; we strip anything that's not ``system`` / ``user`` /
    ``assistant`` defensively rather than letting the SDK raise.
    """
    system_parts: list[str] = []
    chat: list[dict[str, Any]] = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content")
        if not isinstance(role, str) or not isinstance(content, str):
            continue
        if role == "system":
            if content:
                system_parts.append(content)
        elif role in ("user", "assistant"):
            chat.append({"role": role, "content": content})
    system = "\n\n".join(system_parts) if system_parts else None
    return system, chat


def complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> str:
    """Call ``client.messages.create`` and return the assistant text.

    Raises the SDK's native exceptions
    (``anthropic.AuthenticationError``, ``anthropic.APIConnectionError``,
    etc.). The plugin layer wraps these into typed
    :class:`app.exceptions.ExternalServiceError` so the FastAPI
    response stays consistent with the rest of the surface.
    """
    system, chat = _split_system_and_chat(messages)
    client = anthropic.Anthropic(api_key=api_key)
    response = client.messages.create(
        model=model,
        system=system,
        messages=chat,
        max_tokens=max_tokens,
    )
    # ``response.content`` is a list of content blocks; the first
    # text block carries the assistant's response. Concatenate any
    # additional text blocks (the SDK occasionally returns multiple
    # when tool-use is in play, which we don't request here, but
    # being defensive is cheap).
    parts: list[str] = []
    for block in getattr(response, "content", []) or []:
        text = getattr(block, "text", None)
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts)
