"""Adaptive Learner ai-openai plugin (Phase 5-C).

Implements ``ai_complete(messages, model, api_key) -> str`` for any
``model`` whose name starts with ``gpt-`` (e.g. ``gpt-4o``,
``gpt-4o-mini``, ``gpt-4-turbo``).

The hookspec is ``firstresult=True``: when the user's
:attr:`UserSettings.active_provider` is ``openai`` and the model
name matches the prefix, this plugin returns the completion and
pluggy stops. For non-GPT models the plugin returns ``None``
and pluggy falls through to the next AI provider plugin.

Errors raised by the OpenAI SDK are wrapped into
:class:`app.exceptions.ExternalServiceError` so the global handler
maps them to HTTP 502 with a typed detail.
"""

__version__ = "0.4.0"

GPT_MODEL_PREFIX = "gpt-"
