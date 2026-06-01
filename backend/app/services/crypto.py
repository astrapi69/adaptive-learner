"""Symmetric encryption for stored API keys (Phase 1C).

Wraps :class:`cryptography.fernet.Fernet` so the settings router /
service have a single typed entry point and tests get a clean
``reset_fernet_cache`` hook for swapping the in-process key.

Key resolution:

- The encryption key comes from the ``ADAPTIVE_LEARNER_SECRET_KEY``
  environment variable. This module reads ``os.environ`` directly;
  every other source feeds it.
- Three feeder paths (any one works; first hit wins):

  1. **Local dev (recommended)** — ``make dev-secret`` generates a
     Fernet key and persists it to ``.adaptive-learner/dev-secret.env``
     (gitignored). ``make dev`` / ``make dev-bg`` source the file
     before launching uvicorn.
  2. **Inline export** — ``export ADAPTIVE_LEARNER_SECRET_KEY=…``
     in whatever shell you launch uvicorn from.
  3. **Production** — set ``secret_key: <key>`` at the top of
     ``~/.config/adaptive_learner/secrets.yaml``. The layered-config
     loader in :mod:`app.main` (via ``_hydrate_env_from_config``)
     populates ``ADAPTIVE_LEARNER_SECRET_KEY`` from this value at
     startup when the env is unset.

- Tests bypass all three by writing the env var directly in
  ``conftest.py`` before any ``app.*`` import.
- Generate a key with::

      python3 -c "from cryptography.fernet import Fernet; \
                  print(Fernet.generate_key().decode())"

Error surface (typed, fail-fast):

- :class:`CryptoConfigurationError` — the env var is missing or its
  value is not a valid Fernet key. Raised at the first call to
  :func:`get_fernet`, and also from :func:`validate_at_startup`,
  which the FastAPI lifespan invokes once per process so the error
  surfaces before any request lands rather than from a random
  ``encrypt_api_key`` callsite hours later.
- :class:`CryptoDecryptionError` — the ciphertext could not be
  decrypted (likely the key was rotated, or the row is corrupted).
- :class:`ValidationError` — input is empty / not a string. Re-uses
  the global validation error class so the API surface stays
  consistent.

The Fernet instance is cached via ``lru_cache`` for the lifetime of
the process; :func:`reset_fernet_cache` clears it so tests can
rotate the key under monkeypatch.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.exceptions import AdaptiveLearnerError, ValidationError
from app.paths import get_config_dir

logger = logging.getLogger(__name__)

ENV_VAR = "ADAPTIVE_LEARNER_SECRET_KEY"

_SECRET_KEY_FILENAME = "secret.key"


class CryptoConfigurationError(AdaptiveLearnerError):
    """The encryption key is missing or malformed. Raised at
    startup so the deployer sees the failure before the first
    settings request lands."""

    status_code = 500


class CryptoDecryptionError(AdaptiveLearnerError):
    """Stored ciphertext could not be decrypted. Indicates either
    a key rotation without re-encrypting existing rows, or row-
    level corruption."""

    status_code = 500


def secret_key_path() -> Path:
    """Canonical ``~/.config/adaptive_learner/secret.key`` path.

    Resolved fresh via :func:`app.paths.get_config_dir` so test
    overrides via ``ADAPTIVE_LEARNER_CONFIG_DIR`` take effect.
    """
    return get_config_dir() / _SECRET_KEY_FILENAME


def _read_or_create_key_file() -> str:
    """Return the machine-local Fernet key, generating it once.

    The key lives in a persistent file (``secret.key``, 0o600) so it
    survives restarts — the fix for "API keys lost on restart", which
    happened whenever the key came from a value that changed between
    boots. Generate-once: an existing file is NEVER overwritten;
    deleting it loses the keys it protected (the user must re-enter),
    which is the documented + acceptable failure mode.
    """
    path = secret_key_path()
    if path.is_file():
        try:
            return path.read_text(encoding="utf-8").strip()
        except OSError as exc:
            raise CryptoConfigurationError(
                f"Could not read the secret key file at {path}: {exc}."
            ) from exc
    key = Fernet.generate_key().decode("utf-8")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            path.parent.chmod(0o700)
        except OSError:  # noqa: S110 — perms are best-effort on exotic FS
            pass
        path.write_text(key, encoding="utf-8")
        path.chmod(0o600)
    except OSError as exc:
        raise CryptoConfigurationError(
            f"Could not create the secret key file at {path}: {exc}."
        ) from exc
    logger.info("Generated a new machine-local encryption key at %s", path)
    return key


def _resolve_key_material() -> str:
    """Resolve the Fernet key string. Priority (first hit wins):

    1. ``ADAPTIVE_LEARNER_SECRET_KEY`` env var — for Docker / CI /
       explicit deployments that manage the key themselves.
    2. The machine-local ``secret.key`` file — generated once and
       read on every subsequent start (the desktop default).
    """
    env_value = os.environ.get(ENV_VAR, "").strip()
    if env_value:
        return env_value
    return _read_or_create_key_file()


@lru_cache(maxsize=1)
def get_fernet() -> Fernet:
    """Return the process-wide Fernet instance.

    First call resolves the key (env var, else the persistent
    ``secret.key`` file — generated once) and validates it;
    subsequent calls are cache hits. Raises
    :class:`CryptoConfigurationError` on a malformed key value or an
    unreadable / unwritable key file.
    """
    key = _resolve_key_material()
    try:
        return Fernet(key.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        raise CryptoConfigurationError(
            f"The encryption key is not a valid Fernet key: {exc}. "
            f"If it came from {ENV_VAR}, re-generate it; if from the "
            f"secret.key file at {secret_key_path()}, the file is "
            f"corrupt — delete it to regenerate (existing encrypted "
            f"keys will be lost and must be re-entered)."
        ) from exc


def reset_fernet_cache() -> None:
    """Clear the cached Fernet instance.

    Test-only helper: lets a fixture monkeypatch
    ``ADAPTIVE_LEARNER_SECRET_KEY`` and force the next
    :func:`get_fernet` call to re-read it.
    """
    get_fernet.cache_clear()


def validate_at_startup() -> None:
    """Surface a missing / malformed secret key before any request.

    Called once from the FastAPI lifespan. Raises
    :class:`CryptoConfigurationError`; the deployer sees the error
    at boot rather than from a random settings-PATCH handler
    hours later.
    """
    get_fernet()


def encrypt_api_key(plaintext: str) -> str:
    """Encrypt an API key plaintext into a base64 ciphertext string.

    Two encryptions of the same plaintext yield different
    ciphertexts (Fernet embeds a random IV). The result is safe to
    store in a ``Text`` column and survives JSON round-trips.
    """
    if not isinstance(plaintext, str) or not plaintext:
        raise ValidationError("API key must be a non-empty string.")
    fernet = get_fernet()
    return fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_api_key(ciphertext: str) -> str:
    """Decrypt a ciphertext back to the original plaintext."""
    if not isinstance(ciphertext, str) or not ciphertext:
        raise ValidationError("Ciphertext must be a non-empty string.")
    fernet = get_fernet()
    try:
        return fernet.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise CryptoDecryptionError(
            "Could not decrypt API key. The encryption key may have "
            "been rotated, or the stored ciphertext is corrupted."
        ) from exc


__all__ = [
    "ENV_VAR",
    "CryptoConfigurationError",
    "CryptoDecryptionError",
    "decrypt_api_key",
    "encrypt_api_key",
    "get_fernet",
    "reset_fernet_cache",
    "secret_key_path",
    "validate_at_startup",
]
