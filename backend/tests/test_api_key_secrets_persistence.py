"""API-key persistence: stable file-based Fernet key + encrypted
secrets.yaml storage (the "keys lost on restart" fix).

These 17 tests pin the persistence layer end-to-end. The bug they
guard against: a Fernet key that changed between starts made every
stored key undecryptable. The stable ``secret.key`` file + encrypted
``secrets.yaml`` fix that; ``test_api_key_survives_restart`` /
``_10_restarts`` are the tests that would have caught the original
regression.

A "restart" is simulated by ``crypto.reset_fernet_cache()`` — the
key file + secrets.yaml persist on disk, so re-reading after a cache
clear is exactly what a fresh process does.

Every test runs in an isolated ``tmp_path`` config dir
(``ADAPTIVE_LEARNER_CONFIG_DIR``) with no ``ADAPTIVE_LEARNER_SECRET_KEY``
env var, so the file-based stable key + secrets.yaml are exercised and
the real ``~/.config`` is never touched.
"""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import User, UserSettings
from app.repositories.settings_repo import SqlAlchemySettingsRepository
from app.routers.settings import router as settings_router
from app.routers.users import router as users_router
from app.schemas import AIProvider
from app.services import crypto, secrets_service
from app.services import settings as settings_service
from tests.router_test_client import make_client


def _restart() -> None:
    """Simulate a process restart: drop the cached Fernet so the next
    access re-reads the persistent secret.key + secrets.yaml."""
    crypto.reset_fernet_cache()


@pytest.fixture()
def file_key_env(tmp_path, monkeypatch):
    """Isolated config dir + no env secret key, so the file-based
    stable key (secret.key) and encrypted secrets.yaml are used."""
    monkeypatch.setenv("ADAPTIVE_LEARNER_CONFIG_DIR", str(tmp_path))
    monkeypatch.delenv("ADAPTIVE_LEARNER_SECRET_KEY", raising=False)
    crypto.reset_fernet_cache()
    yield tmp_path
    crypto.reset_fernet_cache()


def _mode(path) -> int:
    return path.stat().st_mode & 0o777


# --- secret.key lifecycle ---------------------------------------------------


def test_secret_key_created_on_first_startup(file_key_env):
    path = crypto.secret_key_path()
    assert not path.exists()
    crypto.get_fernet()
    assert path.is_file()
    assert _mode(path) == 0o600
    # The file content is a valid Fernet key.
    Fernet(path.read_text(encoding="utf-8").strip().encode("utf-8"))


def test_secret_key_survives_restart(file_key_env):
    crypto.get_fernet()
    first = crypto.secret_key_path().read_text(encoding="utf-8")
    _restart()
    crypto.get_fernet()
    second = crypto.secret_key_path().read_text(encoding="utf-8")
    assert first == second


def test_secret_key_never_regenerated(file_key_env):
    path = crypto.secret_key_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    known = Fernet.generate_key().decode("utf-8")
    path.write_text(known, encoding="utf-8")
    path.chmod(0o600)
    for _ in range(10):
        _restart()
        crypto.get_fernet()
        assert path.read_text(encoding="utf-8") == known


# --- write + read in secrets.yaml ------------------------------------------


def test_api_key_write_to_secrets_yaml(file_key_env):
    import yaml

    secrets_service.write_api_key("anthropic", "sk-test-123")
    raw = secrets_service.secrets_path().read_text(encoding="utf-8")
    block = yaml.safe_load(raw)["ai"]["anthropic"]
    assert "api_key_encrypted" in block
    assert block["api_key_encrypted"] != "sk-test-123"
    assert "sk-test-123" not in raw
    # Valid Fernet ciphertext (decrypts back).
    assert crypto.decrypt_api_key(block["api_key_encrypted"]) == "sk-test-123"


def test_api_key_roundtrip(file_key_env):
    secrets_service.write_api_key("anthropic", "sk-test-123")
    assert secrets_service.read_api_key("anthropic") == "sk-test-123"


def test_api_key_survives_restart(file_key_env):
    """THE test that would have caught the original bug."""
    secrets_service.write_api_key("anthropic", "sk-test-123")
    _restart()
    assert secrets_service.read_api_key("anthropic") == "sk-test-123"


def test_api_key_survives_10_restarts(file_key_env):
    secrets_service.write_api_key("anthropic", "sk-test-123")
    for _ in range(10):
        _restart()
        assert secrets_service.read_api_key("anthropic") == "sk-test-123"


def test_multiple_providers(file_key_env):
    secrets_service.write_api_key("anthropic", "ant-key")
    secrets_service.write_api_key("openai", "oai-key")
    secrets_service.write_api_key("gemini", "gem-key")
    _restart()
    assert secrets_service.read_api_key("anthropic") == "ant-key"
    assert secrets_service.read_api_key("openai") == "oai-key"
    assert secrets_service.read_api_key("gemini") == "gem-key"


def test_overwrite_key(file_key_env):
    secrets_service.write_api_key("anthropic", "sk-old")
    secrets_service.write_api_key("anthropic", "sk-new")
    _restart()
    assert secrets_service.read_api_key("anthropic") == "sk-new"


def test_delete_key(file_key_env):
    secrets_service.write_api_key("anthropic", "sk-test-123")
    secrets_service.clear_api_key("anthropic")
    _restart()
    assert secrets_service.read_api_key("anthropic") is None


# --- 3-layer precedence -----------------------------------------------------


def test_3_layer_priority(file_key_env, monkeypatch):
    db = SessionLocal()
    try:
        user = User(name="Aster", language="en")
        db.add(user)
        db.commit()
        # DB layer: encrypt under the current (file) key so it decrypts.
        settings = UserSettings(
            user_id=user.id,
            api_key_anthropic=crypto.encrypt_api_key("db-key"),
        )
        db.add(settings)
        db.commit()
        # secrets.yaml layer.
        secrets_service.write_api_key("anthropic", "yaml-key")
        # env layer (highest).
        monkeypatch.setenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", "env-key")

        key, source = settings_service.resolve_api_key(
            SqlAlchemySettingsRepository(db), user.id, AIProvider.ANTHROPIC
        )
        assert key == "env-key"
        assert source.value == "env"

        monkeypatch.delenv("ADAPTIVE_LEARNER_ANTHROPIC_API_KEY", raising=False)
        key, source = settings_service.resolve_api_key(
            SqlAlchemySettingsRepository(db), user.id, AIProvider.ANTHROPIC
        )
        assert key == "yaml-key"
        assert source.value == "secrets_yaml"

        secrets_service.clear_api_key("anthropic")
        key, source = settings_service.resolve_api_key(
            SqlAlchemySettingsRepository(db), user.id, AIProvider.ANTHROPIC
        )
        assert key == "db-key"
        assert source.value == "settings"
    finally:
        db.close()


# --- failure modes ----------------------------------------------------------


def test_corrupted_secret_key(file_key_env):
    crypto.get_fernet()  # create the key file
    crypto.secret_key_path().write_text("garbage-not-a-fernet-key", encoding="utf-8")
    _restart()
    with pytest.raises(crypto.CryptoConfigurationError) as exc:
        crypto.get_fernet()
    assert "secret.key" in str(exc.value)


def test_missing_secret_key_file(file_key_env):
    secrets_service.write_api_key("anthropic", "sk-test-123")
    # Lose the key file -> old ciphertext becomes unreadable (expected).
    crypto.secret_key_path().unlink()
    _restart()
    # Regenerates a fresh key (no crash) ...
    crypto.get_fernet()
    assert crypto.secret_key_path().is_file()
    # ... and the old key is gracefully unreadable, not a crash.
    assert secrets_service.read_api_key("anthropic") is None


# --- permissions ------------------------------------------------------------


def test_secrets_yaml_permissions(file_key_env):
    secrets_service.write_api_key("anthropic", "sk-test-123")
    assert _mode(secrets_service.secrets_path()) == 0o600


def test_secret_key_permissions(file_key_env):
    crypto.get_fernet()
    assert _mode(crypto.secret_key_path()) == 0o600


# --- migration --------------------------------------------------------------


def test_migration_from_db_to_yaml(file_key_env):
    db = SessionLocal()
    try:
        user = User(name="Aster", language="en")
        db.add(user)
        db.commit()
        settings = UserSettings(
            user_id=user.id,
            api_key_anthropic=crypto.encrypt_api_key("db-key"),
        )
        db.add(settings)
        db.commit()

        result = secrets_service.migrate_db_keys(db)
        assert "anthropic" in result["migrated"]

        # Now in secrets.yaml ...
        assert secrets_service.read_api_key("anthropic") == "db-key"
        # ... removed from the DB ...
        db.refresh(settings)
        assert settings.api_key_anthropic is None
        # ... and still resolvable.
        key, _source = settings_service.resolve_api_key(
            SqlAlchemySettingsRepository(db), user.id, AIProvider.ANTHROPIC
        )
        assert key == "db-key"
    finally:
        db.close()


# --- end-to-end via the HTTP API -------------------------------------------


def test_settings_save_and_reload_api_key():
    """POST a key, confirm the source is secrets.yaml, and that it
    survives a simulated restart. Runs against the real settings
    router with the conftest-isolated config dir + Fernet key."""
    client: TestClient = make_client(users_router, settings_router)
    resp = client.post("/api/users", json={"name": "Aster", "language": "en"})
    user_id = resp.json()["id"]

    resp = client.post(
        f"/api/settings/{user_id}/api-key",
        json={"provider": "anthropic", "key": "sk-e2e-persist"},
    )
    assert resp.status_code == 200
    assert resp.json()["key_source_anthropic"] == "secrets_yaml"
    assert resp.json()["has_anthropic_key"] is True

    _restart()
    body = client.get(f"/api/settings/{user_id}").json()
    assert body["key_source_anthropic"] == "secrets_yaml"
    assert body["has_anthropic_key"] is True
    assert secrets_service.read_api_key("anthropic") == "sk-e2e-persist"


# --- the real-world bug: env var set -> secret.key was never created --------


def test_secret_key_created_even_when_env_set(tmp_path, monkeypatch):
    """The exact reported bug: ADAPTIVE_LEARNER_SECRET_KEY was set (e.g.
    by `make dev`), so secret.key was never written and persistence
    still hinged on the env value's stability. It must now be created,
    seeded FROM the env value so existing ciphertext stays decryptable."""
    monkeypatch.setenv("ADAPTIVE_LEARNER_CONFIG_DIR", str(tmp_path))
    env_key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setenv("ADAPTIVE_LEARNER_SECRET_KEY", env_key)
    crypto.reset_fernet_cache()

    crypto.get_fernet()

    path = crypto.secret_key_path()
    assert path.is_file()
    assert path.stat().st_mode & 0o777 == 0o600
    # Seeded from the env value (not a fresh random key) so anything
    # already encrypted under the env key remains readable.
    assert path.read_text(encoding="utf-8").strip() == env_key
    crypto.reset_fernet_cache()


def test_key_survives_env_var_disappearing(tmp_path, monkeypatch):
    """Strongest proof the bug is fixed: encrypt with the env var set,
    then restart with the env var GONE (the original failure mode) and
    confirm the key is still readable because secret.key persisted it."""
    monkeypatch.setenv("ADAPTIVE_LEARNER_CONFIG_DIR", str(tmp_path))
    env_key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setenv("ADAPTIVE_LEARNER_SECRET_KEY", env_key)
    crypto.reset_fernet_cache()
    secrets_service.write_api_key("anthropic", "sk-keep")

    # Restart with the env var removed -> previously this orphaned the key.
    monkeypatch.delenv("ADAPTIVE_LEARNER_SECRET_KEY", raising=False)
    crypto.reset_fernet_cache()
    assert secrets_service.read_api_key("anthropic") == "sk-keep"
