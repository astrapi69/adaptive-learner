"""Tests for ``app.main._hydrate_env_from_config`` (1C-A.7).

The function lets a secret stored in
``~/.config/adaptive_learner/secrets.yaml`` surface as
``ADAPTIVE_LEARNER_SECRET_KEY`` so the crypto module (which reads
``os.environ`` directly) finds it. Production deployers that
prefer the secrets-yaml path no longer have to ``export`` the
key manually.
"""

from __future__ import annotations

import pytest

from app.main import _ENV_CONFIG_SOURCES, _hydrate_env_from_config


@pytest.fixture()
def clear_secret_env(monkeypatch):
    """Drop ADAPTIVE_LEARNER_SECRET_KEY so each test starts fresh."""
    monkeypatch.delenv("ADAPTIVE_LEARNER_SECRET_KEY", raising=False)


def test_mapping_includes_secret_key():
    assert "ADAPTIVE_LEARNER_SECRET_KEY" in _ENV_CONFIG_SOURCES
    assert _ENV_CONFIG_SOURCES["ADAPTIVE_LEARNER_SECRET_KEY"] == ("secret_key",)


def test_hydrates_when_env_empty(clear_secret_env, monkeypatch):
    _hydrate_env_from_config({"secret_key": "from-secrets-yaml"})
    import os

    assert os.environ.get("ADAPTIVE_LEARNER_SECRET_KEY") == "from-secrets-yaml"


def test_env_wins_when_already_set(monkeypatch):
    monkeypatch.setenv("ADAPTIVE_LEARNER_SECRET_KEY", "from-env")
    _hydrate_env_from_config({"secret_key": "from-secrets-yaml"})
    import os

    # Env wins; the config value is ignored.
    assert os.environ["ADAPTIVE_LEARNER_SECRET_KEY"] == "from-env"


def test_no_op_when_config_missing(clear_secret_env):
    _hydrate_env_from_config({})  # no secret_key key at all
    import os

    assert "ADAPTIVE_LEARNER_SECRET_KEY" not in os.environ


def test_no_op_when_config_value_is_none(clear_secret_env):
    _hydrate_env_from_config({"secret_key": None})
    import os

    assert "ADAPTIVE_LEARNER_SECRET_KEY" not in os.environ


def test_no_op_when_config_value_is_non_string(clear_secret_env):
    _hydrate_env_from_config({"secret_key": 12345})
    import os

    assert "ADAPTIVE_LEARNER_SECRET_KEY" not in os.environ


def test_no_op_when_config_value_is_whitespace(clear_secret_env):
    _hydrate_env_from_config({"secret_key": "   "})
    import os

    assert "ADAPTIVE_LEARNER_SECRET_KEY" not in os.environ


def test_walks_nested_dotted_path(clear_secret_env):
    """The current map points at top-level ``secret_key``; this test
    pins that the walker handles the multi-segment case so a
    future entry like ``("ai", "anthropic_key")`` Just Works."""
    # Temporarily extend the map for this test only.
    original = dict(_ENV_CONFIG_SOURCES)
    _ENV_CONFIG_SOURCES["ADAPTIVE_LEARNER_TEST_NESTED"] = ("foo", "bar")
    try:
        import os

        os.environ.pop("ADAPTIVE_LEARNER_TEST_NESTED", None)
        _hydrate_env_from_config({"foo": {"bar": "deep-value"}})
        assert os.environ["ADAPTIVE_LEARNER_TEST_NESTED"] == "deep-value"
    finally:
        _ENV_CONFIG_SOURCES.clear()
        _ENV_CONFIG_SOURCES.update(original)
        os.environ.pop("ADAPTIVE_LEARNER_TEST_NESTED", None)


def test_nested_path_skipped_when_intermediate_missing(clear_secret_env):
    original = dict(_ENV_CONFIG_SOURCES)
    _ENV_CONFIG_SOURCES["ADAPTIVE_LEARNER_TEST_NESTED"] = ("foo", "bar")
    try:
        import os

        os.environ.pop("ADAPTIVE_LEARNER_TEST_NESTED", None)
        _hydrate_env_from_config({"unrelated": {}})
        assert "ADAPTIVE_LEARNER_TEST_NESTED" not in os.environ
    finally:
        _ENV_CONFIG_SOURCES.clear()
        _ENV_CONFIG_SOURCES.update(original)
        os.environ.pop("ADAPTIVE_LEARNER_TEST_NESTED", None)
