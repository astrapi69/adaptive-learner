"""Reset service (Phase 41F Danger Zone).

The user-facing Settings "Danger Zone" wipes EVERY piece of
learner state the backend owns. This service is the
authoritative implementation; the router validates the typed
``RESET`` confirmation token before delegating here.

What gets wiped:

- All SQLite tables (every row in every table, in reverse FK
  order so the child rows go before their parents).
- ``~/.config/adaptive_learner/identity.yaml`` (the Phase 41A
  recovery file).
- The ``ai.*`` block inside
  ``~/.config/adaptive_learner/secrets.yaml`` (API keys + any
  per-provider settings).

What deliberately survives:

- ``secrets.yaml``'s top-level ``secret_key`` field. Removing
  the Fernet key would make any surviving encrypted data
  unreadable forever - a worse failure mode than retaining a
  key whose ciphertexts no longer exist.
- Anything outside the config dir (the app binary itself,
  cache dir, plugin packages).

Best-effort filesystem semantics: a missing secrets.yaml is a
no-op; a permission error during scrubbing is logged and
swallowed so the DB-truncation half of the reset still
counts. The DB truncation is NOT swallowed - a SQLAlchemy
error propagates so the user sees the failure instead of a
false "reset complete" toast.
"""

from __future__ import annotations

import logging
from pathlib import Path

import yaml

from app.paths import get_config_dir
from app.repositories.reset_repo import ResetRepository
from app.services import identity_service

logger = logging.getLogger(__name__)

#: Literal value the frontend must send in the request body. Any
#: other value (including lowercase, partial, or extra whitespace)
#: causes the router to 400 without calling :func:`reset_all`. Same
#: pattern as GitHub's "type the repo name to delete it" - a typed
#: confirmation defeats the "muscle-memory click" mode of
#: destructive errors.
CONFIRMATION_TOKEN = "RESET"

_SECRETS_FILENAME = "secrets.yaml"


def secrets_path() -> Path:
    """Canonical ``~/.config/adaptive_learner/secrets.yaml`` path.

    Resolved fresh via :func:`app.paths.get_config_dir` so test
    overrides via ``ADAPTIVE_LEARNER_CONFIG_DIR`` take effect.
    """
    return get_config_dir() / _SECRETS_FILENAME


def reset_all(repo: ResetRepository) -> int:
    """Wipe every table + every identity / API-key trace on disk.

    Returns the number of tables touched (i.e. the count of
    SQLAlchemy ``Table`` objects truncated). The count reflects work
    attempted, not row counts - the success signal for the frontend
    is "no exception".
    """
    count = repo.truncate_all_tables()

    # Filesystem side-effects after the DB commit succeeds. Any
    # filesystem failure here is logged but does NOT roll back the
    # truncation - we'd rather leave a stale config file than tell
    # the user "reset failed" when their data is already gone.
    identity_service.clear_identity()
    _scrub_secrets_ai_block()

    return count


def _scrub_secrets_ai_block() -> None:
    """Remove the ``ai`` key from ``secrets.yaml``; preserve the rest.

    Specifically preserves the top-level ``secret_key`` Fernet
    field. Deleting it would make any surviving encrypted data
    unreadable forever; since reset truncates the DB anyway, the
    only ciphertexts that could still reference the key are
    backups the user might restore later. Preserving the key
    keeps that restore path open.

    If the resulting file is empty (no fields other than ``ai``
    existed), the file is removed entirely rather than left as an
    empty YAML document.
    """
    path = secrets_path()
    if not path.is_file():
        return
    try:
        raw = path.read_text(encoding="utf-8")
        data = yaml.safe_load(raw)
    except (OSError, yaml.YAMLError) as exc:
        logger.warning("secrets.yaml read failed during reset: %s", exc)
        return
    if not isinstance(data, dict):
        return
    if "ai" not in data:
        return
    del data["ai"]
    if not data:
        # secrets.yaml had only ai.*; remove the file outright.
        try:
            path.unlink()
        except OSError as exc:
            logger.warning("secrets.yaml unlink failed during reset: %s", exc)
        return
    try:
        path.write_text(
            yaml.safe_dump(data, sort_keys=True, allow_unicode=True),
            encoding="utf-8",
        )
        path.chmod(0o600)
    except OSError as exc:
        logger.warning("secrets.yaml rewrite failed during reset: %s", exc)


__all__: list[str] = [
    "CONFIRMATION_TOKEN",
    "reset_all",
    "secrets_path",
]
