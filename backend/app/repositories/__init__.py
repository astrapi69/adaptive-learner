"""Data-layer repositories.

See :mod:`app.repositories.base` for the architectural contract.
FastAPI dependency providers that bind these repositories to a
request-scoped session live in :mod:`app.deps`.
"""

from app.repositories.base import Repository

__all__ = ["Repository"]
