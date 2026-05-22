"""Domain exception hierarchy.

Per ``.claude/rules/code-hygiene.md``: services raise typed
``AdaptiveLearnerError`` subclasses; the global handler in ``main.py`` maps them
to HTTP status codes. Routers stay thin; they catch nothing.
"""

from typing import Any


class AdaptiveLearnerError(Exception):
    """Base for domain errors. Each subclass pins its HTTP status.

    ``extra`` is an optional dict that the global error handler
    merges into the JSON response alongside ``detail``. Subclasses
    use it to carry structured context the frontend needs to act
    on the error — e.g. a ``ConflictError`` for a duplicate import
    surfaces ``{"existing_id": "<uuid>"}`` so the UI can navigate
    to the existing record instead of leaving the user stranded.
    """

    status_code: int = 500

    def __init__(self, detail: str, *, extra: dict[str, Any] | None = None):
        self.detail = detail
        self.extra: dict[str, Any] | None = extra
        super().__init__(detail)


class NotFoundError(AdaptiveLearnerError):
    """Resource lookup miss (-> HTTP 404)."""

    status_code = 404


class ValidationError(AdaptiveLearnerError):
    """Domain validation failed (-> HTTP 400)."""

    status_code = 400


class ConflictError(AdaptiveLearnerError):
    """Resource already exists or state conflict (-> HTTP 409)."""

    status_code = 409


class PayloadTooLargeError(AdaptiveLearnerError):
    """Upload exceeds size cap (-> HTTP 413)."""

    status_code = 413


class ExternalServiceError(AdaptiveLearnerError):
    """External dependency unreachable or returned an error (-> HTTP 502)."""

    status_code = 502

    def __init__(self, service: str, detail: str, *, extra: dict[str, Any] | None = None):
        self.service = service
        super().__init__(f"{service}: {detail}", extra=extra)
