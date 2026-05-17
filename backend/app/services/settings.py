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

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models import User, UserSettings
from app.schemas import AIProvider, ApiKeySetBody, SettingsPatchBody
from app.services import crypto

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
    Raises :class:`NotFoundError` when the user does not exist.
    """
    user = _get_user(db, user_id)
    if user.settings is not None:
        return user.settings
    settings = UserSettings(user_id=user.id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    # Touch the relationship so the @property ``language`` resolves
    # without a lazy-load surprise inside the response serializer.
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
    db.commit()
    db.refresh(settings)
    return settings


def set_api_key(db: Session, user_id: str, payload: ApiKeySetBody) -> UserSettings:
    """Encrypt + store the plaintext API key for the given provider."""
    settings = get_or_create_settings(db, user_id)
    column = _column_for(payload.provider)
    ciphertext = crypto.encrypt_api_key(payload.key)
    setattr(settings, column, ciphertext)
    db.commit()
    db.refresh(settings)
    return settings


def delete_api_key(db: Session, user_id: str, provider: AIProvider) -> UserSettings:
    """Idempotently clear the stored API key for the given provider.

    Returns the updated settings row even if the column was already
    NULL — the frontend's UX expects DELETE to succeed unconditionally
    so the user sees the "key removed" toast either way.
    """
    settings = get_or_create_settings(db, user_id)
    column = _column_for(provider)
    setattr(settings, column, None)
    db.commit()
    db.refresh(settings)
    return settings


def get_decrypted_api_key(db: Session, user_id: str, provider: AIProvider) -> str | None:
    """Decrypt + return the stored plaintext API key.

    Used by the AI provider plugins (Phase 3) — NOT exposed via the
    HTTP API. Returns ``None`` when the column is unset. May raise
    :class:`app.services.crypto.CryptoDecryptionError` when the
    encryption key was rotated without re-encrypting the row.
    """
    settings = get_or_create_settings(db, user_id)
    ciphertext = getattr(settings, _column_for(provider))
    if ciphertext is None:
        return None
    return crypto.decrypt_api_key(ciphertext)


__all__ = [
    "delete_api_key",
    "get_decrypted_api_key",
    "get_or_create_settings",
    "set_api_key",
    "update_settings",
]
