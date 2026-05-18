"""Adaptive Learner ai-anthropic plugin (Phase 3-B).

Implements ``ai_complete(messages, model, api_key) -> str`` for any
``model`` whose name starts with ``claude-`` (e.g. ``claude-sonnet-4-6``).

The hookspec is ``firstresult=True``: when the user's
:attr:`UserSettings.active_provider` is ``anthropic`` and the model
name matches the prefix, this plugin returns the completion and
pluggy stops. For non-Claude models the plugin returns ``None``
and pluggy falls through to the next AI provider plugin
(ai-openai, ai-gemini — to be added in later phases).

Errors raised by the Anthropic SDK are wrapped into
:class:`app.exceptions.ExternalServiceError` so the global handler
maps them to HTTP 502 with a typed detail.
"""

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("adaptive-learner-plugin-ai-anthropic")
except PackageNotFoundError:  # pragma: no cover - dist not installed
    __version__ = "0.0.0+unknown"
CLAUDE_MODEL_PREFIX = "claude-"
