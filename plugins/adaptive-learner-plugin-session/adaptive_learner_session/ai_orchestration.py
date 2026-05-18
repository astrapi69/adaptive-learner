"""AI orchestration for ``POST /api/plugins/session/{id}/message``.

The route saves the user's message, then fans the conversation
history out to the ``ai_complete`` hook (firstresult dispatch:
the matching provider plugin returns the assistant text; every
other plugin returns ``None``). The assistant reply is persisted
as a fresh ``SessionMessage`` row and returned alongside the
user message.

The orchestration is intentionally a separate module so:

  - The route stays a thin shell (validate input, call helpers,
    serialise output).
  - Each step has its own unit-testable function.
  - A future tool-use / function-calling phase can extend the
    pipeline without rewriting the route handler.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Provider-key -> default model. Single source of truth for the
# v0.2.0 ai_complete dispatch. Each provider plugin's ai_complete
# hookimpl picks up its prefix (``claude-`` / ``gpt-`` /
# ``gemini-``) and other prefixes fall through. New providers add
# a row here AND a hookimpl in their plugin.
#
# Models are picked for the cheap-and-fast tier — chat sessions
# don't need GPT-4-Turbo-level reasoning; the learner can swap
# this via the plugin config once the session-plugin config file
# lands. For now: hard-coded so the orchestration is
# self-contained.
DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-3-5-haiku-latest",
    "openai": "gpt-4o-mini",
    "gemini": "gemini-2.0-flash",
}


@dataclass
class AiOrchestrationResult:
    """Composite return for the orchestration.

    ``assistant_text`` is ``None`` when AI couldn't reply (no API
    key configured, hook returned nothing, provider down). The
    route serialises a structured response so the frontend can
    render the user message + surface the AI error separately.
    """

    assistant_text: str | None
    ai_error: str | None


def resolve_model(active_provider: str) -> str | None:
    """Pick the default model for the active provider.

    Returns ``None`` for an unknown provider (e.g. a new provider
    in UserSettings before its plugin lands). The caller treats
    ``None`` the same as "no provider configured".
    """
    return DEFAULT_MODELS.get(active_provider)


def build_messages_history(
    system_prompt: str | None,
    prior_messages: list[dict[str, Any]],
    new_user_content: str,
) -> list[dict[str, Any]]:
    """Compose the messages array passed to ``ai_complete``.

    Shape: ``[system?, *prior_chat, {role:user, content:new_user_content}]``

    ``prior_messages`` is the full SessionMessage history (already
    persisted before this call) in chronological order; we keep
    every entry verbatim so the AI sees the conversation context.
    The fresh user message is appended at the end because the
    orchestrator saves it BEFORE calling this helper.
    """
    out: list[dict[str, Any]] = []
    if isinstance(system_prompt, str) and system_prompt.strip():
        out.append({"role": "system", "content": system_prompt})
    for msg in prior_messages:
        role = msg.get("role")
        content = msg.get("content")
        if isinstance(role, str) and isinstance(content, str):
            out.append({"role": role, "content": content})
    out.append({"role": "user", "content": new_user_content})
    return out


def call_ai_complete(
    *,
    pm: Any,
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
) -> str | None:
    """Fire the ``ai_complete`` hook (firstresult=True).

    Pluggy's firstresult dispatch returns the first non-``None``
    value any registered plugin returned. The orchestrator
    treats a ``None`` return as "no provider matched this model".

    ``pm`` is the pluggy ``PluginManager`` instance (not pluginforge
    — the inner pluggy hook caller). Accepts ``Any`` so this
    helper stays importable from the standalone plugin test
    suite where ``app.main.manager`` is not on sys.path.
    """
    result = pm.hook.ai_complete(messages=messages, model=model, api_key=api_key)
    if isinstance(result, str):
        return result
    return None
