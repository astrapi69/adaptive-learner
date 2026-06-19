"""Regression (#787): importing a backup must never 500 on the
``api_key_backups`` table, and a Dexie-origin backup (cleartext ``key``
instead of Fernet ``encrypted_key``) must be reconciled, not rejected.

Root cause: ``ApiKeyBackup.encrypted_key`` is NOT NULL. A Dexie-mode
backup stores the key in a cleartext ``key`` field (browser-local), so a
naive restore inserted ``encrypted_key=NULL`` and the flush aborted the
WHOLE restore with ``NOT NULL constraint failed:
api_key_backups.encrypted_key``.
"""

from __future__ import annotations

from app.database import SessionLocal
from app.models import ApiKeyBackup, User, UserSettings
from app.repositories.backup_repo import SqlAlchemyBackupRepository
from app.services import crypto
from app.services.backup_service import restore_backup


def _session():
    return SessionLocal()


def _seed_user(db) -> User:
    user = User(name="Aster", email="aster@example.com", language="de")
    db.add(user)
    db.flush()
    db.add(UserSettings(user_id=user.id, active_provider="anthropic"))
    db.commit()
    return user


def _dexie_backup(user_id: str, api_key_backups: list[dict]) -> dict:
    """A minimal Dexie-origin payload carrying only api_key_backups rows."""
    return {
        "format": "adaptive-learner-backup",
        "version": "1.3.0",
        "user_id": user_id,
        "storage_mode": "dexie",
        "data": {"api_key_backups": api_key_backups},
    }


def test_dexie_cleartext_key_is_encrypted_on_import():
    """A row with a cleartext ``key`` (no encrypted_key) is encrypted to
    this install's secret and inserted — not dropped, not a crash."""
    db = _session()
    try:
        user = _seed_user(db)
        payload = _dexie_backup(
            user.id,
            [
                {
                    "id": f"{user.id}#anthropic",
                    "user_id": user.id,
                    "provider": "anthropic",
                    "key": "sk-ant-cleartext-secret",
                    "tested_at": "2026-01-01T00:00:00+00:00",
                    "works": True,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                }
            ],
        )

        result = restore_backup(SqlAlchemyBackupRepository(db), payload)

        assert result["errors"] == []
        assert result["api_keys_skipped"] == 0
        row = (
            db.query(ApiKeyBackup)
            .filter(ApiKeyBackup.user_id == user.id, ApiKeyBackup.provider == "anthropic")
            .one()
        )
        assert row.encrypted_key  # NOT NULL satisfied
        # Round-trips back to the original cleartext via this install's key.
        assert crypto.decrypt_api_key(row.encrypted_key) == "sk-ant-cleartext-secret"
    finally:
        db.close()


def test_api_origin_encrypted_key_is_kept_as_is():
    """An API-origin row already carrying Fernet ``encrypted_key`` imports
    unchanged (legacy + same-mode compatibility)."""
    db = _session()
    try:
        user = _seed_user(db)
        ciphertext = crypto.encrypt_api_key("sk-openai-original")
        payload = _dexie_backup(
            user.id,
            [
                {
                    "id": f"{user.id}#openai",
                    "user_id": user.id,
                    "provider": "openai",
                    "encrypted_key": ciphertext,
                    "tested_at": "2026-01-01T00:00:00+00:00",
                    "works": True,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                }
            ],
        )

        result = restore_backup(SqlAlchemyBackupRepository(db), payload)

        assert result["errors"] == []
        assert result["api_keys_skipped"] == 0
        row = db.query(ApiKeyBackup).filter(ApiKeyBackup.user_id == user.id).one()
        assert row.encrypted_key == ciphertext
    finally:
        db.close()


def test_row_with_no_usable_key_is_skipped_not_crashed():
    """A row with neither ``encrypted_key`` nor a cleartext ``key`` is
    skipped and counted, and the restore completes without error."""
    db = _session()
    try:
        user = _seed_user(db)
        payload = _dexie_backup(
            user.id,
            [
                {
                    "id": f"{user.id}#gemini",
                    "user_id": user.id,
                    "provider": "gemini",
                    "key": "",  # empty -> unusable
                    "tested_at": "2026-01-01T00:00:00+00:00",
                    "works": False,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                }
            ],
        )

        result = restore_backup(SqlAlchemyBackupRepository(db), payload)

        assert result["errors"] == []
        assert result["api_keys_skipped"] == 1
        assert db.query(ApiKeyBackup).filter(ApiKeyBackup.user_id == user.id).count() == 0
    finally:
        db.close()


def test_mixed_rows_partially_import_without_aborting():
    """One usable + one unusable row: the usable one imports, the other is
    skipped, and the whole restore still succeeds (no 500)."""
    db = _session()
    try:
        user = _seed_user(db)
        payload = _dexie_backup(
            user.id,
            [
                {
                    "id": f"{user.id}#anthropic",
                    "user_id": user.id,
                    "provider": "anthropic",
                    "key": "sk-ant-usable",
                    "tested_at": "2026-01-01T00:00:00+00:00",
                    "works": True,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                },
                {
                    "id": f"{user.id}#gemini",
                    "user_id": user.id,
                    "provider": "gemini",
                    "tested_at": "2026-01-01T00:00:00+00:00",
                    "works": False,
                    "created_at": "2026-01-01T00:00:00+00:00",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                },
            ],
        )

        result = restore_backup(SqlAlchemyBackupRepository(db), payload)

        assert result["errors"] == []
        assert result["api_keys_skipped"] == 1
        rows = db.query(ApiKeyBackup).filter(ApiKeyBackup.user_id == user.id).all()
        assert len(rows) == 1
        assert rows[0].provider == "anthropic"
    finally:
        db.close()
