"""Phase 1C-A tests for app.services.crypto."""

from __future__ import annotations

import pytest
from cryptography.fernet import Fernet

from app.exceptions import ValidationError
from app.services.crypto import (
    ENV_VAR,
    CryptoConfigurationError,
    CryptoDecryptionError,
    decrypt_api_key,
    encrypt_api_key,
    get_fernet,
    reset_fernet_cache,
    validate_at_startup,
)


@pytest.fixture()
def restore_fernet_cache():
    """Save + restore the Fernet cache around tests that mutate
    ``ADAPTIVE_LEARNER_SECRET_KEY``.

    Without this, a test that monkeypatches the env var and calls
    ``reset_fernet_cache()`` leaves the next test with a cleared
    cache that re-reads the (now restored) conftest key — which is
    fine, but the explicit reset makes the contract obvious.
    """
    reset_fernet_cache()
    yield
    reset_fernet_cache()


# --- happy path -------------------------------------------------------------


def test_get_fernet_returns_a_fernet_instance():
    f = get_fernet()
    assert isinstance(f, Fernet)


def test_get_fernet_is_cached():
    """Same instance on every call so encryption stays cheap."""
    assert get_fernet() is get_fernet()


def test_round_trip_recovers_plaintext():
    plaintext = "sk-anthropic-pretend-1234567890"
    ciphertext = encrypt_api_key(plaintext)
    assert decrypt_api_key(ciphertext) == plaintext


def test_encrypt_output_does_not_contain_plaintext():
    plaintext = "sk-anthropic-pretend-uniquesecret"
    ciphertext = encrypt_api_key(plaintext)
    assert plaintext not in ciphertext


def test_two_encryptions_of_same_plaintext_yield_different_ciphertexts():
    """Fernet embeds a random IV; equal plaintexts must NOT produce
    the same ciphertext or pattern-analysis attacks become trivial.
    """
    a = encrypt_api_key("same-key")
    b = encrypt_api_key("same-key")
    assert a != b
    # Both still decrypt to the original.
    assert decrypt_api_key(a) == "same-key"
    assert decrypt_api_key(b) == "same-key"


def test_encrypted_output_is_ascii_safe_string():
    """The ciphertext must survive a JSON / sqlite Text round-trip
    without binary escaping (Fernet uses url-safe base64)."""
    ciphertext = encrypt_api_key("contains unicode: aerzte")
    assert isinstance(ciphertext, str)
    ciphertext.encode("ascii")  # must not raise


# --- input validation ------------------------------------------------------


@pytest.mark.parametrize("bad", ["", None, 0, [], b"bytes-not-str"])
def test_encrypt_rejects_empty_or_non_string(bad):
    with pytest.raises(ValidationError):
        encrypt_api_key(bad)  # type: ignore[arg-type]


@pytest.mark.parametrize("bad", ["", None, 0, [], b"bytes-not-str"])
def test_decrypt_rejects_empty_or_non_string(bad):
    with pytest.raises(ValidationError):
        decrypt_api_key(bad)  # type: ignore[arg-type]


def test_decrypt_garbage_raises_typed_error():
    with pytest.raises(CryptoDecryptionError):
        decrypt_api_key("not-a-valid-fernet-token")


def test_decrypt_with_rotated_key_raises_typed_error(monkeypatch, restore_fernet_cache):
    """Encrypting under one key then decrypting under another must
    raise :class:`CryptoDecryptionError` (not a low-level
    ``InvalidToken`` leak)."""
    original_ciphertext = encrypt_api_key("rotated-secret")
    monkeypatch.setenv(ENV_VAR, Fernet.generate_key().decode("utf-8"))
    reset_fernet_cache()
    with pytest.raises(CryptoDecryptionError):
        decrypt_api_key(original_ciphertext)


# --- startup validation ----------------------------------------------------


def test_validate_at_startup_succeeds_with_env_set():
    """Sanity: under the conftest's auto-set key the startup check
    is a no-op (no exception)."""
    validate_at_startup()


def test_get_fernet_raises_on_missing_env_var(monkeypatch, restore_fernet_cache):
    monkeypatch.delenv(ENV_VAR, raising=False)
    reset_fernet_cache()
    with pytest.raises(CryptoConfigurationError) as exc:
        get_fernet()
    # Message must point the user at the fix, not just say "missing".
    assert ENV_VAR in str(exc.value)
    assert "Fernet.generate_key" in str(exc.value)


def test_get_fernet_raises_on_malformed_key(monkeypatch, restore_fernet_cache):
    monkeypatch.setenv(ENV_VAR, "not-a-fernet-key")
    reset_fernet_cache()
    with pytest.raises(CryptoConfigurationError) as exc:
        get_fernet()
    assert ENV_VAR in str(exc.value)


def test_validate_at_startup_propagates_missing_key(monkeypatch, restore_fernet_cache):
    monkeypatch.delenv(ENV_VAR, raising=False)
    reset_fernet_cache()
    with pytest.raises(CryptoConfigurationError):
        validate_at_startup()
