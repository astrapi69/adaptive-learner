"""Adaptive Learner ai-perplexity plugin (#2512).

Implements ``ai_complete(messages, model, api_key) -> str`` for any
``model`` whose name starts with ``sonar`` (``sonar``, ``sonar-pro``,
``sonar-reasoning``).

Perplexity's API is OpenAI-compatible (bearer token, POST
``{base_url}/chat/completions``), so the client is the OpenAI SDK
pointed at ``https://api.perplexity.ai``. The provider blocks
browser CORS calls (``corsBlocked`` in the frontend registry), which
is why the browser-direct Dexie mode marks it desktop-only and this
backend plugin is the one real call path.

The hookspec is ``firstresult=True``: when the user's
:attr:`UserSettings.active_provider` is ``perplexity`` and the model
name matches the prefix, this plugin returns the completion and
pluggy stops. For non-sonar models the plugin returns ``None`` and
pluggy falls through to the next AI provider plugin.

Errors raised by the SDK are wrapped into
:class:`app.exceptions.ExternalServiceError` so the global handler
maps them to HTTP 502 with a typed detail.
"""

try:
    from importlib.metadata import PackageNotFoundError
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("adaptive-learner-plugin-ai-perplexity")
except PackageNotFoundError:  # pragma: no cover - dist not installed
    __version__ = "0.0.0+unknown"
SONAR_MODEL_PREFIX = "sonar"
