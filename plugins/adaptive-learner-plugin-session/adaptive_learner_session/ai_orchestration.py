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

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

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
    # Bumped 2026-05-20 from ``claude-3-5-haiku-latest`` to the
    # Haiku 4.5 dated alias after v0.9.0 conversation-analysis
    # surfaced 3-5-haiku's unreliability at structured JSON
    # output. Haiku 4.5 follows system-prompt instructions much
    # more tightly while staying in the same cost tier.
    "anthropic": "claude-haiku-4-5-20251001",
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


def resolve_model(active_provider: str, override: str | None = None) -> str | None:
    """Pick the model string for the active provider.

    v0.4.0: a non-empty ``override`` wins over ``DEFAULT_MODELS``
    for that provider — the Settings page lets users pick a model
    per provider (e.g. ``claude-sonnet-4-20250514`` instead of the
    cheap ``claude-3-5-haiku-latest`` default). Whitespace-only
    overrides are treated as "no override". ``None`` (override
    not set) falls back to the default.

    Returns ``None`` for an unknown provider with no override — a
    new provider in UserSettings before its plugin lands. The
    caller treats ``None`` the same as "no provider configured".
    """
    if isinstance(override, str) and override.strip():
        return override.strip()
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
    max_tokens: int | None = None,
) -> str | None:
    """Fire the ``ai_complete`` hook (firstresult=True).

    Pluggy's firstresult dispatch returns the first non-``None``
    value any registered plugin returned. The orchestrator
    treats a ``None`` return as "no provider matched this model".

    ``pm`` is the pluggy ``PluginManager`` instance (not pluginforge
    — the inner pluggy hook caller). Accepts ``Any`` so this
    helper stays importable from the standalone plugin test
    suite where ``app.main.manager`` is not on sys.path.

    v0.5.0: ``max_tokens`` (optional) caps the provider's completion
    length. ``None`` (the default) leaves the provider's own default
    in place. The Phase 8B step-evaluator uses 256.
    """
    result = pm.hook.ai_complete(
        messages=messages,
        model=model,
        api_key=api_key,
        max_tokens=max_tokens,
    )
    if isinstance(result, str):
        return result
    return None


async def call_ai_complete_async(
    *,
    pm: Any,
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int | None = None,
) -> str | None:
    """v1.5.0 / Phase 18B - async fire of the ai_complete hook.

    Prefers ``ai_complete_async`` when any registered plugin
    implements it (provider plugin returns a coroutine that the
    orchestrator awaits). Falls back to ``ai_complete`` wrapped
    in ``asyncio.to_thread`` so the existing sync provider plugins
    keep working unchanged.

    The asyncio.gather path in the v1.5.0 message route uses this
    helper to fan out evaluation + topic-transition calls in
    parallel even when only sync providers are loaded — the thread
    pool gives real overlap without forcing a provider rewrite.
    """
    import asyncio

    # Try the async hook first. Some pluggy builds raise if the
    # hookspec was never declared OR no plugin implements it; the
    # try/except guards both.
    try:
        async_hook = getattr(pm.hook, "ai_complete_async", None)
        if async_hook is not None:
            result = async_hook(
                messages=messages,
                model=model,
                api_key=api_key,
                max_tokens=max_tokens,
            )
            if asyncio.iscoroutine(result):
                result = await result
            if isinstance(result, str):
                return result
    except Exception as err:  # noqa: BLE001 — fallback to sync below
        logger.debug("Async ai_complete hook unavailable, falling back to sync: %s", err)

    # Fallback: run the sync hook on a thread so the caller can
    # await it and still benefit from asyncio.gather parallelism.
    def _call_sync() -> str | None:
        return call_ai_complete(
            pm=pm,
            messages=messages,
            model=model,
            api_key=api_key,
            max_tokens=max_tokens,
        )

    return await asyncio.to_thread(_call_sync)


async def call_ai_complete_stream(
    *,
    pm: Any,
    messages: list[dict[str, Any]],
    model: str,
    api_key: str,
    max_tokens: int | None = None,
):
    """v1.6.0 / Phase 19 - fire the ``ai_complete_stream`` hook.

    Returns an async iterator yielding ``str`` chunks, or ``None``
    when no registered plugin implements the stream hook. Callers
    fall back to :func:`call_ai_complete_async` on ``None``.

    Why a wrapper instead of dispatching pluggy directly:

    - The stream hook may return the iterator directly OR a
      coroutine that resolves to one (depends on whether the
      plugin's hookimpl is ``async def`` or plain ``def``). The
      wrapper normalises both to "directly async-iterable".
    - When the hookspec is registered but no plugin claims it,
      pluggy returns ``None`` — the wrapper surfaces that as a
      ``None`` return so the caller can branch cleanly.
    - The hookspec is ``firstresult=True``: exactly one provider
      plugin answers; pluggy enforces first-non-None on dispatch.
    """
    import asyncio
    import inspect

    stream_hook = getattr(pm.hook, "ai_complete_stream", None)
    if stream_hook is None:
        return None
    try:
        result = stream_hook(
            messages=messages,
            model=model,
            api_key=api_key,
            max_tokens=max_tokens,
        )
    except Exception:  # noqa: BLE001 — fallback to async hook in the caller
        return None
    if result is None:
        return None
    # An ``async def`` hookimpl returns a coroutine; await it to
    # get the async iterator. A plain ``def`` hookimpl that
    # ``return``s an async generator returns it directly.
    if asyncio.iscoroutine(result):
        result = await result
    if result is None:
        return None
    if not hasattr(result, "__aiter__") and not inspect.isasyncgen(result):
        return None
    return result
