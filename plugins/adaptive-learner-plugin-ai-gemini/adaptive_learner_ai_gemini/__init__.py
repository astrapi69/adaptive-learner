"""Adaptive Learner ai-gemini plugin (Phase 5-C).

Implements ``ai_complete(messages, model, api_key) -> str`` for any
``model`` whose name starts with ``gemini-`` (e.g.
``gemini-2.0-flash``, ``gemini-1.5-pro``).

The hookspec is ``firstresult=True``: when the user's
:attr:`UserSettings.active_provider` is ``gemini`` and the model
name matches the prefix, this plugin returns the completion and
pluggy stops. For non-Gemini models the plugin returns ``None``
and pluggy falls through to the next AI provider plugin.

Gemini's chat API uses ``user`` and ``model`` roles (not
``assistant``); the client wrapper translates the
OpenAI-style messages list into Gemini's history shape and
lifts ``role=system`` entries into the ``system_instruction``
constructor kwarg.

Errors raised by the Gemini SDK are wrapped into
:class:`app.exceptions.ExternalServiceError`.
"""

__version__ = "0.2.0"

GEMINI_MODEL_PREFIX = "gemini-"
