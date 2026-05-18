"""AiGeminiPlugin — PluginForge entry point.

Owns the ``ai_complete`` hook for any model starting with
``gemini-``. Returns ``None`` for any other model so pluggy
falls through to the next AI provider plugin (firstresult
dispatch).
"""

from __future__ import annotations

from typing import Any

import pluggy
from pluginforge import BasePlugin

from . import GEMINI_MODEL_PREFIX
from .client import complete as _complete

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class AiGeminiPlugin(BasePlugin):
    name = "ai-gemini"
    version = "0.1.0"
    description = "Google Gemini provider for the ai_complete hook."
    author = "Asterios Raptis"

    @hookimpl
    def ai_complete(self, messages: list[dict[str, Any]], model: str, api_key: str) -> str | None:
        if not isinstance(model, str) or not model.startswith(GEMINI_MODEL_PREFIX):
            # Not for us. firstresult=True semantics: None tells
            # pluggy to try the next plugin.
            return None
        if not isinstance(api_key, str) or not api_key:
            from app.exceptions import ValidationError

            raise ValidationError("ai-gemini: api_key must be a non-empty string.")
        try:
            return _complete(messages, model, api_key)
        except Exception as exc:
            # Wrap any SDK exception into the typed external-service
            # error. Lazy import to keep the plugin class importable
            # from its own standalone tests dir (app.* isn't on
            # sys.path there).
            from app.exceptions import ExternalServiceError

            raise ExternalServiceError("gemini", str(exc)) from exc
