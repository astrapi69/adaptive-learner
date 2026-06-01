"""File-based, encrypted API-key storage in ``secrets.yaml``.

API keys are stored Fernet-encrypted (under the machine-local stable
key from :mod:`app.services.crypto`) in
``~/.config/adaptive_learner/secrets.yaml`` as
``ai.<provider>.api_key_encrypted``. This is the PRIMARY write target
for desktop (API-mode) users: because the encryption key now lives in
a persistent ``secret.key`` file, a saved API key survives restarts —
the fix for the "keys lost on restart" bug, which happened when the
key was encrypted in the DB under a value that changed between boots.

Read precedence inside the file: an encrypted ``api_key_encrypted``
wins; a legacy hand-edited plaintext ``api_key`` is still honoured.
The Fernet-encrypted DB column remains a read fallback (via
:func:`app.services.settings.get_decrypted_api_key`) until the startup
:func:`migrate_db_keys` moves keys across.

File hygiene mirrors ssh: ``secrets.yaml`` is written ``0o600`` inside
a ``0o700`` config dir; a group/world-accessible file logs a WARNING.
"""

from __future__ import annotations

import logging
import stat
from pathlib import Path

import yaml
from sqlalchemy.orm import Session

from app.paths import get_config_dir
from app.services import crypto

logger = logging.getLogger(__name__)

_SECRETS_FILENAME = "secrets.yaml"

#: Supported provider keys (string values of ``schemas.AIProvider``).
PROVIDERS: tuple[str, ...] = ("anthropic", "openai", "gemini")

#: Provider -> the legacy ``UserSettings`` ciphertext column. Kept
#: local (not imported from settings_service) to avoid an import cycle.
_DB_COLUMNS: dict[str, str] = {
    "anthropic": "api_key_anthropic",
    "openai": "api_key_openai",
    "gemini": "api_key_gemini",
}


def secrets_path() -> Path:
    """Canonical ``~/.config/adaptive_learner/secrets.yaml`` path,
    resolved fresh so ``ADAPTIVE_LEARNER_CONFIG_DIR`` test overrides
    take effect."""
    return get_config_dir() / _SECRETS_FILENAME


def _load() -> dict:
    """Parse secrets.yaml into a dict. Missing / malformed / non-mapping
    content yields ``{}`` (never raises)."""
    path = secrets_path()
    if not path.is_file():
        return {}
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        logger.warning("secrets.yaml read failed: %s", exc)
        return {}
    return data if isinstance(data, dict) else {}


def _write(data: dict) -> None:
    """Write the dict to secrets.yaml with 0o600 perms in a 0o700 dir."""
    path = secrets_path()
    config_dir = path.parent
    config_dir.mkdir(parents=True, exist_ok=True)
    try:
        config_dir.chmod(0o700)
    except OSError:  # best-effort on exotic filesystems
        pass
    path.write_text(
        yaml.safe_dump(data, sort_keys=True, allow_unicode=True),
        encoding="utf-8",
    )
    try:
        path.chmod(0o600)
    except OSError as exc:
        logger.warning("Could not set 0o600 perms on %s: %s", path, exc)


def warn_if_permissions_too_open(path: Path | None = None) -> bool:
    """Log a WARNING (and return True) when the secrets file is
    group/world-accessible, like ssh's permission check."""
    target = path or secrets_path()
    if not target.is_file():
        return False
    mode = target.stat().st_mode
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        logger.warning(
            "secrets file %s is group/world-accessible (mode %o); run `chmod 600 %s`.",
            target,
            stat.S_IMODE(mode),
            target,
        )
        return True
    return False


def write_api_key(provider: str, plaintext: str) -> None:
    """Encrypt + store the API key for ``provider`` in secrets.yaml.

    Overwrites any existing value for that provider and drops a stale
    plaintext ``api_key`` field if one was hand-written there.
    """
    ciphertext = crypto.encrypt_api_key(plaintext)
    data = _load()
    ai = data.get("ai")
    if not isinstance(ai, dict):
        ai = {}
    block = ai.get(provider)
    if not isinstance(block, dict):
        block = {}
    block["api_key_encrypted"] = ciphertext
    block.pop("api_key", None)
    ai[provider] = block
    data["ai"] = ai
    _write(data)


def clear_api_key(provider: str) -> None:
    """Remove the provider's block from secrets.yaml (idempotent).
    Removes the file entirely if nothing else remains."""
    data = _load()
    ai = data.get("ai")
    if not isinstance(ai, dict) or provider not in ai:
        return
    ai.pop(provider, None)
    if ai:
        data["ai"] = ai
    else:
        data.pop("ai", None)
    if data:
        _write(data)
    else:
        try:
            secrets_path().unlink()
        except OSError:
            pass


def read_api_key(provider: str) -> str | None:
    """Return the decrypted API key for ``provider`` from secrets.yaml.

    Prefers the encrypted ``api_key_encrypted`` field; falls back to a
    legacy plaintext ``api_key``. Returns ``None`` when absent or when
    decryption fails (e.g. the secret.key changed) — the caller then
    falls through to the next layer instead of crashing.
    """
    ai = _load().get("ai")
    if not isinstance(ai, dict):
        return None
    block = ai.get(provider)
    if not isinstance(block, dict):
        return None
    encrypted = block.get("api_key_encrypted")
    if isinstance(encrypted, str) and encrypted.strip():
        try:
            return crypto.decrypt_api_key(encrypted.strip())
        except crypto.CryptoDecryptionError:
            logger.warning(
                "Could not decrypt the stored %s key — the secret.key "
                "may have changed; the user must re-enter it.",
                provider,
            )
            return None
    plaintext = block.get("api_key")
    if isinstance(plaintext, str) and plaintext.strip():
        return plaintext.strip()
    return None


def migrate_db_keys(db: Session) -> dict[str, list[str]]:
    """Move legacy DB-encrypted keys into secrets.yaml at startup.

    For every provider column set across all ``UserSettings`` rows:

    - secrets.yaml already has the provider -> just clear the DB column.
    - otherwise try to decrypt the DB ciphertext under the current
      stable key:

        * success -> re-encrypt into secrets.yaml + clear the DB column.
        * failure -> the value was encrypted under a now-lost key; clear
          the dead column so it stops shadowing (the user re-enters).

    Returns ``{"migrated": [...], "lost": [...]}`` of provider names.
    Commits only when something changed. Never raises — a migration
    hiccup must not block startup.
    """
    from app.models import UserSettings

    migrated: list[str] = []
    lost: list[str] = []
    changed = False
    try:
        rows = db.query(UserSettings).all()
    except Exception as exc:  # noqa: BLE001 — startup must not crash here
        logger.warning("API-key migration skipped (query failed): %s", exc)
        return {"migrated": migrated, "lost": lost}

    for row in rows:
        for provider, column in _DB_COLUMNS.items():
            ciphertext = getattr(row, column, None)
            if not ciphertext:
                continue
            if read_api_key(provider) is not None:
                setattr(row, column, None)
                changed = True
                continue
            try:
                plaintext = crypto.decrypt_api_key(ciphertext)
            except crypto.CryptoDecryptionError:
                setattr(row, column, None)
                changed = True
                lost.append(provider)
                continue
            write_api_key(provider, plaintext)
            setattr(row, column, None)
            changed = True
            migrated.append(provider)

    if changed:
        db.commit()
    if migrated or lost:
        logger.info(
            "API-key migration to secrets.yaml: migrated=%s lost=%s",
            migrated,
            lost,
        )
    return {"migrated": migrated, "lost": lost}


__all__ = [
    "PROVIDERS",
    "clear_api_key",
    "migrate_db_keys",
    "read_api_key",
    "secrets_path",
    "warn_if_permissions_too_open",
    "write_api_key",
]
