"""Thin wrapper around the google-generativeai SDK.

Kept separate from :mod:`.plugin` so:

- The wrapper is unit-testable in isolation (mock
  ``adaptive_learner_ai_gemini.client.genai``).
- The plugin's ``ai_complete`` hookimpl only has to do the routing
  (gemini-prefix check, exception wrapping).

Gemini's chat API differs from OpenAI / Anthropic in two ways:

  1. Roles are ``user`` and ``model`` (NOT ``user`` /
     ``assistant``). The wrapper translates assistant -> model.
  2. There is no inline ``system`` role; system instructions go
     in the GenerativeModel constructor's ``system_instruction``
     kwarg. The wrapper pops every system message into a single
     newline-joined instruction.

The contract returned to the orchestrator is the same string the
other provider wrappers return — the role translation is opaque
to the caller.
"""

from __future__ import annotations

from typing import Any

# Top-level import so tests can patch the bound name on this
# module. The lazy-import-bypasses-the-mock trap documented in
# the ai-anthropic + ai-openai clients applies here too.
import google.generativeai as genai

DEFAULT_MAX_TOKENS = 2048

# Map OpenAI-style roles to the Gemini-style roles the SDK
# accepts in ``history`` entries.
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
    ``parts: [text]`` per the Gemini history schema.
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
        chat.append({"role": mapped, "parts": [content]})
    system_instruction = "\n\n".join(system_parts) if system_parts else None
    return system_instruction, chat


def complete(
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> str:
    """Call ``genai.GenerativeModel.generate_content`` and return
    the assistant text.

    Raises the SDK's native exceptions; the plugin layer wraps
    these into typed :class:`app.exceptions.ExternalServiceError`.
    """
    system_instruction, history = _split_system_and_chat(messages)
    # ``genai.configure`` is process-global; calling per-request
    # is wasteful but safe and keeps the API surface flat. A
    # future per-user-thread model could memoise.
    genai.configure(api_key=api_key)
    generative_model = genai.GenerativeModel(
        model_name=model,
        system_instruction=system_instruction,
        generation_config={"max_output_tokens": max_tokens},
    )
    # The simplest call shape: pass the full history list to
    # generate_content. Gemini will treat the LAST entry's
    # ``parts`` as the user turn and the prior entries as
    # history. An empty history (no user message) still calls
    # generate_content with an empty list, which the SDK
    # rejects loudly — the orchestrator always appends at
    # least the new user message before calling here.
    response = generative_model.generate_content(history)
    text = getattr(response, "text", None)
    return text if isinstance(text, str) else ""
