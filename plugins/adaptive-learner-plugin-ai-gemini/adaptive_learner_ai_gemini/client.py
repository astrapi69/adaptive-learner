"""Thin wrapper around the google-genai SDK.

Phase 6E: migrated from ``google.generativeai`` (deprecated,
EOL announced) to ``google.genai`` (current line). The new
SDK exposes a ``Client(api_key=...)`` entrypoint and a
``client.models.generate_content`` call surface; the previous
``genai.configure`` + ``genai.GenerativeModel`` shape is gone.

Kept separate from :mod:`.plugin` so:

- The wrapper is unit-testable in isolation (mock
  ``adaptive_learner_ai_gemini.client.genai``).
- The plugin's ``ai_complete`` hookimpl only has to do the routing
  (gemini-prefix check, exception wrapping).

Gemini's chat API differs from OpenAI / Anthropic in two ways:

  1. Roles are ``user`` and ``model`` (NOT ``user`` /
     ``assistant``). The wrapper translates assistant -> model.
  2. There is no inline ``system`` role; system instructions go
     in the per-call config's ``system_instruction`` field. The
     wrapper pops every system message into a single newline-
     joined instruction.

The contract returned to the orchestrator is the same string the
other provider wrappers return — the role translation is opaque
to the caller.
"""

from __future__ import annotations

from typing import Any

# Top-level import so tests can patch the bound name on this
# module. The lazy-import-bypasses-the-mock trap documented in
# the ai-anthropic + ai-openai clients applies here too.
from google import genai
from google.genai import types as genai_types

DEFAULT_MAX_TOKENS = 2048

# Map OpenAI-style roles to the Gemini-style roles the SDK
# accepts in ``contents`` entries.
_ROLE_MAP: dict[str, str] = {
    "user": "user",
    "assistant": "model",
}


def _split_system_and_chat(
    messages: list[dict[str, Any]],
) -> tuple[str | None, list[dict[str, Any]]]:
    """Pop every ``role="system"`` entry into a single
    system-instruction string; translate user/assistant roles
    into Gemini's user/model roles. ``content`` becomes
    ``parts: [{"text": ...}]`` per the google-genai 2.x Content
    schema. (The old 0.8.x SDK accepted ``parts: [str]``; the
    new SDK requires the ``{"text": str}`` shape on every part.)
    """
    system_parts: list[str] = []
    chat: list[dict[str, Any]] = []
    for msg in messages:
        role = msg.get("role")
        content = msg.get("content")
        if not isinstance(role, str) or not isinstance(content, str) or not content:
            continue
        if role == "system":
            system_parts.append(content)
            continue
        mapped = _ROLE_MAP.get(role)
        if mapped is None:
            continue
        chat.append({"role": mapped, "parts": [{"text": content}]})
    system_instruction = "\n\n".join(system_parts) if system_parts else None
    return system_instruction, chat


def _build_config(
    system_instruction: str | None, max_tokens: int
) -> genai_types.GenerateContentConfig:
    """Phase 36 Bug 5 — symmetric with the Anthropic guard:
    ``system_instruction`` is only set when there is a real value
    so the wire shape stays clean. The google-genai SDK accepts
    ``None`` defensively, but omitting the kwarg matches the
    Anthropic-side fix and keeps the three provider wrappers
    behaviourally identical.
    """
    config_kwargs: dict[str, Any] = {"max_output_tokens": max_tokens}
    if system_instruction is not None:
        config_kwargs["system_instruction"] = system_instruction
    return genai_types.GenerateContentConfig(**config_kwargs)


def complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> str:
    """Call ``client.models.generate_content`` and return the
    assistant text.

    Raises the SDK's native exceptions; the plugin layer wraps
    these into typed :class:`app.exceptions.ExternalServiceError`.
    """
    system_instruction, contents = _split_system_and_chat(messages)
    client = genai.Client(api_key=api_key)
    config = _build_config(system_instruction, max_tokens)
    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )
    # ``response.text`` is a convenience attribute that joins
    # every text part of the first candidate. Returns the empty
    # string when a safety filter blocks the response (rather
    # than raising), which matches the OpenAI wrapper's edge-
    # case behaviour.
    text = getattr(response, "text", None)
    return text if isinstance(text, str) else ""


async def stream(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
):
    """v1.6.0 / Phase 19 — yield text deltas as Gemini streams them.

    Uses ``client.aio.models.generate_content_stream(...)`` from
    the google-genai SDK, which yields ``GenerateContentResponse``
    chunks. Each chunk's ``.text`` attribute carries the next
    delta (or the empty string for non-text chunks — safety
    flags, finish reasons). The wrapper drops empty deltas.

    Raises the SDK's native exceptions; the plugin's hookimpl
    wraps them as ``ExternalServiceError``.
    """
    system_instruction, contents = _split_system_and_chat(messages)
    client = genai.Client(api_key=api_key)
    config = _build_config(system_instruction, max_tokens)
    async for chunk in await client.aio.models.generate_content_stream(
        model=model,
        contents=contents,
        config=config,
    ):
        text = getattr(chunk, "text", None)
        if isinstance(text, str) and text:
            yield text
