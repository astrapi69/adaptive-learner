"""Machine-readable classification of a failed tutor turn (#3376).

The exchange response carries ``ai_error`` (a technical one-liner) and
``ai_error_code`` (one of the constants below). The frontend maps the code
to a localized message and shows the raw text only in developer mode; the
browser session flow emits the same codes, so both storage modes guide the
learner the same way.
"""

from __future__ import annotations

from app.exceptions import AdaptiveLearnerError

NO_PROVIDER = "no_provider"
NO_API_KEY = "no_api_key"
NO_MODEL = "no_model"
PROVIDER_AUTH = "provider_auth"
PROVIDER_RATE_LIMITED = "provider_rate_limited"
PROVIDER_UNAVAILABLE = "provider_unavailable"
PROVIDER_ERROR = "provider_error"

_AUTH_STATUSES = frozenset({401, 403})
_RATE_LIMIT_STATUS = 429
_UNAVAILABLE_NAME_HINTS = ("connection", "connect", "timeout", "network", "unavailable")


def _status_of(exc: BaseException) -> int | None:
    """HTTP status an SDK or httpx exception carries, if any."""
    for attr in ("status_code", "code", "status"):
        value = getattr(exc, attr, None)
        if isinstance(value, int) and 100 <= value <= 599:
            return value
    response = getattr(exc, "response", None)
    status = getattr(response, "status_code", None)
    return status if isinstance(status, int) else None


def _chain(exc: BaseException) -> list[BaseException]:
    """The exception plus its causes, outermost first (cycle-safe)."""
    seen: list[BaseException] = []
    current: BaseException | None = exc
    while current is not None and current not in seen:
        seen.append(current)
        current = current.__cause__ or current.__context__
    return seen


def classify_provider_exception(exc: BaseException) -> str:
    """Map a provider failure onto an ``ai_error_code``.

    Provider plugins wrap SDK errors in ``ExternalServiceError`` with the
    original as ``__cause__``, so the whole chain below the wrapper is
    inspected: an HTTP status wins, then a connection/timeout class name,
    else the generic ``provider_error``.

    Args:
        exc: The exception raised by the ``ai_complete`` hook.

    Returns:
        One of the module's code constants.
    """
    # The app's own wrapper carries its HTTP mapping (502) as
    # ``status_code``; only the provider's status says what went wrong.
    chain = [link for link in _chain(exc) if not isinstance(link, AdaptiveLearnerError)]
    for link in chain:
        status = _status_of(link)
        if status in _AUTH_STATUSES:
            return PROVIDER_AUTH
        if status == _RATE_LIMIT_STATUS:
            return PROVIDER_RATE_LIMITED
        if status is not None and status >= 500:
            return PROVIDER_UNAVAILABLE
    for link in chain:
        names = " ".join(cls.__name__.lower() for cls in type(link).__mro__)
        if any(hint in names for hint in _UNAVAILABLE_NAME_HINTS):
            return PROVIDER_UNAVAILABLE
    return PROVIDER_ERROR
