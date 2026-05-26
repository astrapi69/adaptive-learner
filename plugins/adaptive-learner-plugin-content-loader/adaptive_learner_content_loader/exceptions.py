"""Typed exceptions for the Content-Loader (Phase 43 / EXP-002).

Mirrors the AdaptiveLearnerError hierarchy from
``app/exceptions.py``: services raise typed domain exceptions
(NotFound / Auth / Network / generic Fetch), the route layer
catches them and maps to HTTP status codes via the existing
global exception handler.

The loader's exceptions deliberately do NOT inherit from
``AdaptiveLearnerError`` directly — the plugin runs inside its
own venv with NO dependency on the backend app package. Routes
in the backend (commit 6) wrap each loader exception in the
appropriate ``AdaptiveLearnerError`` subclass for HTTP mapping.
This keeps the plugin shippable as a standalone PyPI package
in the future.
"""

from __future__ import annotations


class ContentLoaderError(Exception):
    """Base class for every Content-Loader runtime error."""

    def __init__(self, message: str, *, detail: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.detail = detail or message


class ContentNotFoundError(ContentLoaderError):
    """A requested resource was 404 on the upstream source.

    Surfaced when: a manifest path returns 404, a lesson file
    is missing from a published set, a referenced asset is
    not on the upstream branch.
    """


class ContentAuthError(ContentLoaderError):
    """The upstream returned 401 / 403.

    Most common cause: a private repo needs a token. The
    Settings UI surfaces a guidance link to the secrets chain
    documentation when this fires.
    """


class ContentNetworkError(ContentLoaderError):
    """The upstream is unreachable (DNS, ECONNREFUSED, timeout)."""


class ContentFetchError(ContentLoaderError):
    """Catch-all for unexpected HTTP failure modes (5xx, etc.)."""


class ContentSchemaError(ContentLoaderError):
    """Downloaded payload failed Pydantic schema validation.

    Distinct from a fetch error: the bytes arrived fine but
    they don't conform to the manifest / lesson schema. The
    Settings UI shows the validation detail so the content
    author can fix their PR.
    """
