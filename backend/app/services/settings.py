"""UserSettings CRUD service (Phase 1C-D).

Spans two tables: :class:`UserSettings` (per-user provider +
encrypted API-key columns) and :class:`User` (the ``language``
field, which the frontend Settings page edits through this same
endpoint).

API-key writes go through :func:`set_api_key` / :func:`delete_api_key`
only; the PATCH endpoint cannot touch them. Plaintext keys never
hit disk — :mod:`app.services.crypto` Fernet-wraps every write and
the :class:`UserSettings` ORM model exposes only ``has_<provider>_key``
booleans to the schema layer.
"""

from __future__ import annotations

import os
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models import ApiKeyBackup, User, UserSettings
from app.schemas import AIProvider, ApiKeySetBody, ApiKeySource, SettingsPatchBody
from app.services import crypto, secrets_service

# Column name lookup so the router doesn't have to switch on the
# provider enum. Keeping the map here (vs deriving from f-strings)
# keeps the read paths explicit and stops a typo from silently
# writing to the wrong column.
_PROVIDER_COLUMNS: dict[AIProvider, str] = {
    AIProvider.ANTHROPIC: "api_key_anthropic",
    AIProvider.OPENAI: "api_key_openai",
    AIProvider.GEMINI: "api_key_gemini",
}


def _column_for(provider: AIProvider) -> str:
    column = _PROVIDER_COLUMNS.get(provider)
    if column is None:
        # AIProvider is an enum, so callers can only get here by
        # extending the enum without updating the map.
        raise ValidationError(f"Unsupported AI provider: {provider!r}")
    return column


def _get_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id!r} not found.")
    return user


def get_or_create_settings(db: Session, user_id: str) -> UserSettings:
    """Return the user's settings row, creating it on first access.

    The frontend Settings page expects ``GET /api/settings/{id}`` to
    always return a row; an empty / default UserSettings is the
    natural shape for a brand-new account. The auto-create is
    idempotent and stays in one transaction.

    Concurrent first-access (React 18 strict-mode double-effect or
    parallel GET requests) used to race: both callers passed the
    ``user.settings is None`` check, both INSERTed, the second hit
    the ``unique=True`` constraint on ``user_id`` and bubbled up as
    HTTP 500. Catch the IntegrityError, roll back the doomed insert,
    and re-read the row the other request just committed.
    Raises :class:`NotFoundError` when the user does not exist.
    """
    user = _get_user(db, user_id)
    if user.settings is not None:
        return user.settings
    settings = UserSettings(user_id=user.id)
    db.add(settings)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        db.refresh(user, attribute_names=["settings"])
        if user.settings is None:
            raise
        return user.settings
    db.refresh(settings)
    _ = settings.user
    return settings


def update_settings(db: Session, user_id: str, payload: SettingsPatchBody) -> UserSettings:
    """Apply a partial PATCH across UserSettings + User.

    Only fields the client explicitly set are written. The User
    update happens in the same transaction as the UserSettings
    update so the response always reflects a consistent snapshot.
    """
    user = _get_user(db, user_id)
    settings = get_or_create_settings(db, user_id)
    fields = payload.model_dump(exclude_unset=True)
    if "active_provider" in fields and fields["active_provider"] is not None:
        # Pydantic coerces the AIProvider enum back to its string
        # value when ``model_dump`` is called (because the model
        # field uses the enum directly). Store the string value.
        settings.active_provider = (
            fields["active_provider"].value
            if hasattr(fields["active_provider"], "value")
            else str(fields["active_provider"])
        )
    if "language" in fields and fields["language"] is not None:
        user.language = fields["language"]
    # v0.4.0 — model overrides per provider. Empty string clears
    # the override (column → NULL → "use the default"); non-empty
    # string sets it. ``None`` (field omitted) leaves the column
    # alone.
    for column in ("model_override_anthropic", "model_override_openai", "model_override_gemini"):
        if column in fields and fields[column] is not None:
            stripped = fields[column].strip()
            setattr(settings, column, stripped or None)
    db.commit()
    db.refresh(settings)
    return settings


def set_api_key(db: Session, user_id: str, payload: ApiKeySetBody) -> UserSettings:
    """Persist the API key to ``secrets.yaml``, Fernet-encrypted under
    the machine-local stable key.

    secrets.yaml is the primary store now (it survives restarts; the
    old DB-encrypted-under-a-volatile-key path lost keys on restart).
    The DB column is no longer written; it remains only a read
    fallback for not-yet-migrated legacy keys. Returns the settings
    row so the router can build the response (the source will resolve
    to ``secrets.yaml``)."""
    settings = get_or_create_settings(db, user_id)
    secrets_service.write_api_key(payload.provider.value, payload.key)
    return settings


def delete_api_key(db: Session, user_id: str, provider: AIProvider) -> UserSettings:
    """Idempotently clear the stored API key for the given provider.

    Returns the updated settings row even if the column was already
    NULL — the frontend's UX expects DELETE to succeed unconditionally
    so the user sees the "key removed" toast either way.
    """
    settings = get_or_create_settings(db, user_id)
    # Clear from BOTH the secrets.yaml store (primary) and the legacy
    # DB column, so a delete is total regardless of where the key lived.
    secrets_service.clear_api_key(provider.value)
    column = _column_for(provider)
    setattr(settings, column, None)
    db.commit()
    db.refresh(settings)
    return settings


def backup_api_key(db: Session, user_id: str, provider: AIProvider, key: str) -> None:
    """Cache ``key`` as the last-known-good backup for (user, provider).

    Called by the save flow ONLY after the key tested successfully.
    Fernet-encrypts the key and upserts the single per-(user, provider)
    ApiKeyBackup row.
    """
    existing = (
        db.query(ApiKeyBackup)
        .filter(
            ApiKeyBackup.user_id == user_id,
            ApiKeyBackup.provider == provider.value,
        )
        .one_or_none()
    )
    ciphertext = crypto.encrypt_api_key(key)
    if existing is None:
        db.add(
            ApiKeyBackup(
                user_id=user_id,
                provider=provider.value,
                encrypted_key=ciphertext,
                works=True,
            )
        )
    else:
        existing.encrypted_key = ciphertext
        existing.works = True
    db.commit()


def get_api_key_backup(db: Session, user_id: str, provider: AIProvider) -> ApiKeyBackup | None:
    """Return the backup row for (user, provider), or ``None``."""
    return (
        db.query(ApiKeyBackup)
        .filter(
            ApiKeyBackup.user_id == user_id,
            ApiKeyBackup.provider == provider.value,
        )
        .one_or_none()
    )


def restore_api_key_backup(db: Session, user_id: str, provider: AIProvider) -> UserSettings:
    """Restore the cached last-known-good key as the active key.

    Decrypts the backup and writes it through the normal save path
    (secrets.yaml). Raises :class:`NotFoundError` when no backup
    exists for the provider.
    """
    backup = get_api_key_backup(db, user_id, provider)
    if backup is None:
        raise NotFoundError(f"No API-key backup for provider {provider.value}")
    plaintext = crypto.decrypt_api_key(backup.encrypted_key)
    settings = get_or_create_settings(db, user_id)
    secrets_service.write_api_key(provider.value, plaintext)
    return settings


def get_decrypted_api_key(db: Session, user_id: str, provider: AIProvider) -> str | None:
    """Decrypt + return the stored plaintext API key from the DB.

    DB-only primitive — does NOT consult env vars or
    ``~/.config/adaptive_learner/secrets.yaml``. Plugin callers
    that want the full env > secrets.yaml > DB precedence chain
    should use :func:`resolve_api_key` instead.

    Returns ``None`` when the column is unset. May raise
    :class:`app.services.crypto.CryptoDecryptionError` when the
    encryption key was rotated without re-encrypting the row.
    """
    settings = get_or_create_settings(db, user_id)
    ciphertext = getattr(settings, _column_for(provider))
    if ciphertext is None:
        return None
    return crypto.decrypt_api_key(ciphertext)


# Phase 34 (v1.20.0) — file-based config + key resolution chain.
# The maps below mirror ``backend/app/main.py:_ENV_SECRET_OVERRIDES``
# but at the per-provider granularity the resolver needs. Keeping
# them adjacent to the resolver (rather than importing from main)
# avoids the circular ``main -> settings_service -> main`` cycle
# that would otherwise form if we used the canonical map.

_PROVIDER_ENV_VARS: dict[AIProvider, str] = {
    AIProvider.ANTHROPIC: "ADAPTIVE_LEARNER_ANTHROPIC_API_KEY",
    AIProvider.OPENAI: "ADAPTIVE_LEARNER_OPENAI_API_KEY",
    AIProvider.GEMINI: "ADAPTIVE_LEARNER_GEMINI_API_KEY",
}

_PROVIDER_MODEL_ENV_VARS: dict[AIProvider, str] = {
    AIProvider.ANTHROPIC: "ADAPTIVE_LEARNER_ANTHROPIC_DEFAULT_MODEL",
    AIProvider.OPENAI: "ADAPTIVE_LEARNER_OPENAI_DEFAULT_MODEL",
    AIProvider.GEMINI: "ADAPTIVE_LEARNER_GEMINI_DEFAULT_MODEL",
}


def _read_secrets_yaml_block(provider: AIProvider) -> dict[str, Any]:
    """Read just the ``ai.<provider>`` block from the secrets.yaml
    overlay, bypassing env-var injection.

    Lazy-imports ``app.main`` to dodge the import cycle (main
    imports the settings router which imports this service).
    Returns ``{}`` when the file is missing / malformed / the block
    is absent. Never raises.
    """
    from app.main import _get_user_override_path, _load_override_file

    try:
        data = _load_override_file(_get_user_override_path())
    except Exception:  # noqa: BLE001 — loader already logs warnings
        return {}
    ai_block = data.get("ai") if isinstance(data, dict) else None
    if not isinstance(ai_block, dict):
        return {}
    provider_block = ai_block.get(provider.value)
    if not isinstance(provider_block, dict):
        return {}
    return provider_block


def detect_api_key_source(db: Session, user_id: str, provider: AIProvider) -> ApiKeySource:
    """Resolve the per-provider key source for the Settings UI.

    Precedence matches :func:`resolve_api_key`. The Settings GET
    endpoint calls this once per provider to surface "Key from:
    secrets.yaml" / "Key from: environment" / "Key from: Settings"
    affordances and disable the Save button when the key is
    externally managed.

    Distinguishing env-direct from env-hydrated-from-yaml is a
    heuristic: when the env var is set AND matches the yaml value
    byte-for-byte, we attribute to yaml (the common "user only
    edits yaml" case). When the env var is set with a different
    value (or yaml has no value), we attribute to env.
    """
    env_var = _PROVIDER_ENV_VARS.get(provider)
    env_value = os.environ.get(env_var) if env_var else None
    yaml_value = secrets_service.read_api_key(provider.value)

    if env_value:
        if yaml_value and env_value.strip() == yaml_value:
            return ApiKeySource.SECRETS_YAML
        return ApiKeySource.ENV
    if yaml_value:
        return ApiKeySource.SECRETS_YAML
    settings = get_or_create_settings(db, user_id)
    if getattr(settings, _column_for(provider)) is not None:
        return ApiKeySource.SETTINGS
    return ApiKeySource.NONE


def resolve_api_key(
    db: Session, user_id: str, provider: AIProvider
) -> tuple[str | None, ApiKeySource]:
    """Resolve a plaintext API key + its source.

    Precedence (highest wins):
      1. Environment variable (``ADAPTIVE_LEARNER_<PROVIDER>_API_KEY``)
         set BEFORE startup, or set programmatically and differing
         from the yaml value.
      2. ``~/.config/adaptive_learner/secrets.yaml`` —
         ``ai.<provider>.api_key``.
      3. Database :class:`UserSettings` (Fernet-decrypted from the
         encrypted column).
      4. ``None`` — no key configured anywhere.

    The returned :class:`ApiKeySource` mirrors which layer the key
    came from. Plugin callers should switch from
    :func:`get_decrypted_api_key` to this function so file-based
    + env-based desktop configurations work transparently.
    """
    env_var = _PROVIDER_ENV_VARS.get(provider)
    env_value = os.environ.get(env_var, "").strip() if env_var else ""
    yaml_value = secrets_service.read_api_key(provider.value) or ""

    if env_value:
        # Heuristic for source attribution — see
        # :func:`detect_api_key_source`.
        if yaml_value and env_value == yaml_value:
            return env_value, ApiKeySource.SECRETS_YAML
        return env_value, ApiKeySource.ENV
    if yaml_value:
        return yaml_value, ApiKeySource.SECRETS_YAML
    db_key = get_decrypted_api_key(db, user_id, provider)
    if db_key:
        return db_key, ApiKeySource.SETTINGS
    return None, ApiKeySource.NONE


def resolve_default_model(db: Session, user_id: str, provider: AIProvider) -> str | None:
    """Resolve the per-provider default model.

    Precedence (highest wins):
      1. ``ADAPTIVE_LEARNER_<PROVIDER>_DEFAULT_MODEL`` env var.
      2. ``~/.config/adaptive_learner/secrets.yaml`` —
         ``ai.<provider>.default_model``.
      3. ``UserSettings.model_override_<provider>`` (Settings UI).
      4. ``None`` — caller falls back to the plugin's
         ``DEFAULT_MODELS[provider]`` constant.

    Returns the resolved model id string, or ``None`` when nothing
    is configured anywhere. Per the v1.20.0 design, secrets.yaml
    beats the UI override (power-user file config wins over UI).
    """
    env_var = _PROVIDER_MODEL_ENV_VARS.get(provider)
    env_value = os.environ.get(env_var, "").strip() if env_var else ""
    if env_value:
        return env_value
    yaml_block = _read_secrets_yaml_block(provider)
    yaml_value = yaml_block.get("default_model") if isinstance(yaml_block, dict) else None
    if isinstance(yaml_value, str) and yaml_value.strip():
        return yaml_value.strip()
    settings = get_or_create_settings(db, user_id)
    override_attr = f"model_override_{provider.value}"
    override = getattr(settings, override_attr, None)
    if isinstance(override, str) and override.strip():
        return override.strip()
    return None


__all__ = [
    "delete_api_key",
    "detect_api_key_source",
    "get_decrypted_api_key",
    "get_or_create_settings",
    "resolve_api_key",
    "resolve_default_model",
    "set_api_key",
    "update_settings",
]
