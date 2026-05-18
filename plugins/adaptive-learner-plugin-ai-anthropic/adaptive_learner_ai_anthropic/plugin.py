"""AiAnthropicPlugin — PluginForge entry point.

Owns the ``ai_complete`` hook for any model starting with
``claude-``. Returns ``None`` for any other model so pluggy falls
through to the next AI provider plugin (firstresult dispatch).
"""

from __future__ import annotations

from typing import Any

import pluggy
from pluginforge import BasePlugin

from . import CLAUDE_MODEL_PREFIX
from .client import complete as _complete

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class AiAnthropicPlugin(BasePlugin):
    name = "ai-anthropic"
    version = "0.1.0"
    description = "Anthropic Claude provider for the ai_complete hook."
    author = "Asterios Raptis"

    @hookimpl
    def ai_complete(self, messages: list[dict[str, Any]], model: str, api_key: str) -> str | None:
        if not isinstance(model, str) or not model.startswith(CLAUDE_MODEL_PREFIX):
            # Not for us. firstresult=True semantics: None tells
            # pluggy to try the next plugin (a future ai-openai
            # or ai-gemini).
            return None
        if not isinstance(api_key, str) or not api_key:
            # Wrong provider routed here, or settings UI handed us
            # an empty string. Defer to the global error handler by
            # raising a typed exception.
            from app.exceptions import ValidationError

            raise ValidationError("ai-anthropic: api_key must be a non-empty string.")
        try:
            return _complete(messages, model, api_key)
        except Exception as exc:
            # Wrap any SDK exception (auth, network, rate-limit, ...)
            # into the typed external-service error so the FastAPI
            # response carries a stable shape. Lazy import to keep
            # the plugin class importable from its own standalone
            # tests dir (app.* isn't on sys.path there).
            from app.exceptions import ExternalServiceError

            raise ExternalServiceError("anthropic", str(exc)) from exc
