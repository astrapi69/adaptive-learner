"""AiPerplexityPlugin - PluginForge entry point.

Owns the ``ai_complete`` hook for any model starting with
``sonar``. Returns ``None`` for any other model so pluggy falls
through to the next AI provider plugin (firstresult dispatch).
"""

from __future__ import annotations

from typing import Any

import pluggy
from pluginforge import BasePlugin

from . import SONAR_MODEL_PREFIX
from .client import complete as _complete
from .client import stream as _stream

hookimpl = pluggy.HookimplMarker("adaptive_learner.plugins")


class AiPerplexityPlugin(BasePlugin):
    name = "ai-perplexity"
    version = "0.1.0"
    target_application = "adaptive_learner"
    description = "Perplexity sonar provider for the ai_complete hook (OpenAI-compatible)."
    author = "Asterios Raptis"

    @hookimpl
    def ai_complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        api_key: str,
        max_tokens: int | None = None,
    ) -> str | None:
        if not isinstance(model, str) or not model.startswith(SONAR_MODEL_PREFIX):
            # Not for us. firstresult=True semantics: None tells
            # pluggy to try the next plugin.
            return None
        if not isinstance(api_key, str) or not api_key:
            from app.exceptions import ValidationError

            raise ValidationError("ai-perplexity: api_key must be a non-empty string.")
        client_kwargs: dict[str, Any] = {}
        if isinstance(max_tokens, int) and max_tokens > 0:
            client_kwargs["max_tokens"] = max_tokens
        try:
            return _complete(messages, model, api_key, **client_kwargs)
        except Exception as exc:
            # Wrap any SDK exception (auth, network, rate-limit, ...)
            # into the typed external-service error so the FastAPI
            # response carries a stable shape. Lazy import to keep
            # the plugin class importable from its own standalone
            # tests dir (app.* isn't on sys.path there).
            from app.exceptions import ExternalServiceError

            raise ExternalServiceError("perplexity", str(exc)) from exc

    @hookimpl
    def ai_complete_stream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        api_key: str,
        max_tokens: int | None = None,
    ):
        """Streaming variant of :meth:`ai_complete`.

        Returns an async generator yielding text deltas. Returns
        ``None`` when the model isn't sonar-prefixed so pluggy
        moves on to the next provider plugin.
        """
        if not isinstance(model, str) or not model.startswith(SONAR_MODEL_PREFIX):
            return None
        if not isinstance(api_key, str) or not api_key:
            from app.exceptions import ValidationError

            raise ValidationError("ai-perplexity: api_key must be a non-empty string.")
        kwargs: dict[str, Any] = {}
        if isinstance(max_tokens, int) and max_tokens > 0:
            kwargs["max_tokens"] = max_tokens

        async def _generator():
            try:
                async for chunk in _stream(messages, model, api_key, **kwargs):
                    yield chunk
            except Exception as exc:
                from app.exceptions import ExternalServiceError

                raise ExternalServiceError("perplexity", str(exc)) from exc

        return _generator()
